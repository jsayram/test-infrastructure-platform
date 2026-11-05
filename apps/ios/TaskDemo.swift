import SwiftUI

@main
struct TaskDemoApp: App {
    var body: some Scene {
        WindowGroup { WorkspaceView() }
    }
}

struct DemoUser: Decodable {
    let id: String
}

struct DemoTask: Decodable, Identifiable {
    let id: String
    let title: String
    let completed: Bool
}

enum DemoAPI {
    private static let origin = "http://127.0.0.1:8080"

    static func open(_ name: String) async throws -> DemoUser {
        var lookup = URLComponents(string: origin + "/api/users")!
        lookup.queryItems = [URLQueryItem(name: "name", value: name)]
        do {
            return try await send(lookup.url!)
        } catch let error as HTTPError where error.status == 404 {
            do {
                return try await send(URL(string: origin + "/api/users")!,
                                      method: "POST", body: ["name": name])
            } catch let error as HTTPError where error.status == 409 {
                return try await send(lookup.url!)
            }
        }
    }

    static func tasks(_ user: DemoUser) async throws -> [DemoTask] {
        try await send(tasksURL(user))
    }

    static func add(_ title: String, to user: DemoUser) async throws -> DemoTask {
        try await send(tasksURL(user), method: "POST", body: ["title": title])
    }

    static func complete(_ task: DemoTask, for user: DemoUser) async throws -> DemoTask {
        try await send(tasksURL(user).appendingPathComponent(task.id),
                       method: "PATCH", body: ["completed": true])
    }

    private static func tasksURL(_ user: DemoUser) -> URL {
        URL(string: origin + "/api/users/" + user.id + "/tasks")!
    }

    private struct HTTPError: Error {
        let status: Int
    }

    private static func send<Response: Decodable>(
        _ url: URL, method: String = "GET", body: [String: Any]? = nil
    ) async throws -> Response {
        var request = URLRequest(url: url, timeoutInterval: 5)
        request.httpMethod = method
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else { throw HTTPError(status: status) }
        return try JSONDecoder().decode(Response.self, from: data)
    }
}

struct WorkspaceView: View {
    @State private var name = ""
    @State private var title = ""
    @State private var user: DemoUser?
    @State private var tasks: [DemoTask] = []
    @State private var busy = false
    @State private var error: String?
    @FocusState private var focused: Bool

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text(user == nil ? "Open a demo workspace" : "Tasks")
                    .font(.title)
                    .accessibilityAddTraits(.isHeader)
                if let user {
                    TextField("Task title", text: $title)
                        .accessibilityIdentifier("task_title")
                        .focused($focused)
                        .textFieldStyle(.roundedBorder)
                        .submitLabel(.done)
                        .onSubmit { add(user) }
                    Button("Add task") { add(user) }
                        .accessibilityIdentifier("add_task")
                        .disabled(busy || title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

                    if tasks.isEmpty { Text("No tasks yet.") }
                    ForEach(tasks) { task in
                        VStack(alignment: .leading, spacing: 5) {
                            Text(task.title)
                            Text(task.completed ? "Completed" : "Open")
                            if !task.completed {
                                Button("Complete task") {
                                    perform("Could not complete the task.") {
                                        let updated = try await DemoAPI.complete(task, for: user)
                                        tasks = tasks.map { $0.id == updated.id ? updated : $0 }
                                    }
                                }
                                .accessibilityIdentifier("complete_task")
                                .disabled(busy)
                            }
                        }
                    }
                } else {
                    TextField("Demo name", text: $name)
                        .accessibilityIdentifier("workspace_name")
                        .focused($focused)
                        .textFieldStyle(.roundedBorder)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .submitLabel(.go)
                        .onSubmit(open)
                    Button("Continue", action: open)
                        .accessibilityIdentifier("open_workspace")
                        .disabled(busy || name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
                if let error { Text(error).foregroundStyle(.red) }
            }
            .padding()
            .frame(maxWidth: 500, alignment: .leading)
        }
    }

    private func open() {
        let name = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return }
        perform("Could not open the workspace.") {
            let opened = try await DemoAPI.open(name)
            tasks = try await DemoAPI.tasks(opened)
            user = opened
        }
    }

    private func add(_ user: DemoUser) {
        let title = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else { return }
        perform("Could not add the task.") {
            tasks.append(try await DemoAPI.add(title, to: user))
            self.title = ""
        }
    }

    private func perform(_ failure: String, action: @escaping () async throws -> Void) {
        guard !busy else { return }
        busy = true
        error = nil
        focused = false
        Task {
            defer { busy = false }
            do { try await action() } catch { self.error = failure }
        }
    }
}
