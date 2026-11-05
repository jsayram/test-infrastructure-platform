package dev.testinfra.demo

import android.app.Activity
import android.os.Bundle
import android.view.View
import android.view.inputmethod.InputMethodManager
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URI
import java.net.URLEncoder
import java.util.concurrent.Executors

class MainActivity : Activity() {
    private val background = Executors.newSingleThreadExecutor()
    private lateinit var content: LinearLayout
    private lateinit var error: TextView
    private var user: String? = null
    private var tasks = emptyList<DemoTask>()
    private var busy = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        render()
    }

    override fun onDestroy() {
        background.shutdownNow()
        super.onDestroy()
    }

    private fun render() {
        content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(24.dp, 24.dp, 24.dp, 24.dp)
            isFocusableInTouchMode = true
        }
        setContentView(ScrollView(this).apply { addView(content) })
        content.requestFocus()
        val owner = user
        if (owner == null) {
            label("Open a demo workspace", 24f)
            val input = field("Demo name", R.id.workspace_name)
            button("Continue", R.id.open_workspace) {
                val name = input.text.toString().trim()
                if (name.isNotEmpty()) runAction("Could not open the workspace.", {
                    val opened = DemoAPI.open(name)
                    opened to DemoAPI.tasks(opened)
                }) { (opened, listed) -> user = opened; tasks = listed }
            }
        } else {
            label("Tasks", 24f)
            val input = field("Task title", R.id.task_title)
            button("Add task", R.id.add_task) {
                val title = input.text.toString().trim()
                if (title.isNotEmpty()) runAction("Could not add the task.",
                    { DemoAPI.add(owner, title) }) { tasks = tasks + it }
            }
            if (tasks.isEmpty()) label("No tasks yet.")
            for (task in tasks) {
                label(task.title)
                label(if (task.completed) "Completed" else "Open")
                if (!task.completed) {
                    button("Complete task", R.id.complete_task) {
                        runAction("Could not complete the task.",
                            { DemoAPI.complete(owner, task.id) }) { updated ->
                            tasks = tasks.map { if (it.id == updated.id) updated else it }
                        }
                    }
                }
            }
        }
        error = label("").apply { visibility = View.GONE }
    }

    private fun <T> runAction(message: String, action: () -> T, update: (T) -> Unit) {
        if (busy) return
        busy = true
        error.visibility = View.GONE
        currentFocus?.let {
            getSystemService(InputMethodManager::class.java).hideSoftInputFromWindow(it.windowToken, 0)
        }
        background.execute {
            val outcome = runCatching(action)
            runOnUiThread {
                if (isDestroyed) return@runOnUiThread
                busy = false
                outcome.onSuccess {
                    update(it)
                    render()
                }.onFailure {
                    error.text = message
                    error.visibility = View.VISIBLE
                }
            }
        }
    }

    private val Int.dp: Int get() = (this * resources.displayMetrics.density).toInt()

    private fun label(value: String, size: Float = 16f): TextView =
        TextView(this).apply {
            text = value
            textSize = size
            setPadding(0, 8.dp, 0, 8.dp)
            content.addView(this)
        }

    private fun field(placeholder: String, identifier: Int): EditText =
        EditText(this).apply {
            id = identifier
            hint = placeholder
            isSingleLine = true
            inputType = android.text.InputType.TYPE_CLASS_TEXT or
                android.text.InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
            content.addView(this)
        }

    private fun button(title: String, identifier: Int, action: () -> Unit) {
        content.addView(Button(this).apply {
            id = identifier
            text = title
            isAllCaps = false
            setOnClickListener { action() }
        })
    }
}

private data class DemoTask(val id: String, val title: String, val completed: Boolean)

private object DemoAPI {
    private const val origin = "http://10.0.2.2:8080"
    private const val users = "/api/users"

    fun open(name: String): String {
        val lookup = users + "?name=" + URLEncoder.encode(name, "UTF-8")
        val raw = try {
            send(lookup)
        } catch (error: HTTPError) {
            if (error.status != 404) throw error
            try {
                send(users, "POST", JSONObject().put("name", name))
            } catch (conflict: HTTPError) {
                if (conflict.status != 409) throw conflict
                send(lookup)
            }
        }
        return JSONObject(raw).getString("id")
    }

    fun tasks(user: String): List<DemoTask> {
        val data = JSONArray(send(taskPath(user)))
        return List(data.length()) { task(data.getJSONObject(it)) }
    }

    fun add(user: String, title: String): DemoTask =
        task(JSONObject(send(taskPath(user), "POST", JSONObject().put("title", title))))

    fun complete(user: String, id: String): DemoTask =
        task(JSONObject(send(taskPath(user) + "/" + id, "PATCH", JSONObject().put("completed", true))))

    private fun taskPath(user: String): String = "$users/$user/tasks"
    private fun task(data: JSONObject) =
        DemoTask(data.getString("id"), data.getString("title"), data.getBoolean("completed"))

    private class HTTPError(val status: Int) : Exception()

    private fun send(path: String, method: String = "GET", body: JSONObject? = null): String {
        val connection = URI.create(origin + path).toURL().openConnection() as HttpURLConnection
        return try {
            connection.requestMethod = method
            connection.instanceFollowRedirects = false
            connection.connectTimeout = 5000
            connection.readTimeout = 5000
            if (body != null) {
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json")
                connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            }
            val status = connection.responseCode
            if (status !in 200..299) throw HTTPError(status)
            connection.inputStream.bufferedReader().use { it.readText() }
        } finally {
            connection.disconnect()
        }
    }
}
