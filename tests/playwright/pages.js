export class WorkspacePage {
  constructor(page) {
    this.page = page;
    this.name = page.getByRole('textbox', { name: 'Demo name' });
    this.continue = page.getByRole('button', { name: 'Continue' });
  }

  async open(name) {
    await this.page.goto('/');
    await this.name.fill(name);
    await this.continue.click();
  }
}

export class TasksPage {
  constructor(page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Tasks', exact: true });
    this.title = page.getByRole('textbox', { name: 'Task title' });
    this.addButton = page.getByRole('button', { name: 'Add task' });
    this.error = page.getByRole('alert');
    this.list = page.getByRole('list', { name: 'Task list' });
  }

  row(title) {
    return this.list.getByRole('listitem').filter({
      has: this.page.getByText(title, { exact: true }),
    });
  }

  async add(title) {
    await this.title.fill(title);
    await this.addButton.click();
  }

  async complete(title) {
    await this.row(title).getByRole('button', { name: 'Complete', exact: true }).click();
  }

  async remove(title) {
    await this.row(title).getByRole('button', { name: 'Delete', exact: true }).click();
  }
}
