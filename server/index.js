const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const { exec } = require('child_process');
const { promisify } = require('util');
const { randomUUID } = require('crypto');

const execAsync = promisify(exec);
const app = express();
const server = http.createServer(app);

const wss = new WebSocketServer({ server, path: '/ws' });
const PORT = 3001;

let tasks = [];

app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

function broadcast(type, payload) {
  const message = JSON.stringify({ type, payload });

  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(message);
    }
  }
}

app.get('/api/tasks', async (req, res) => {
  res.json(tasks);
});

app.post('/api/tasks', async (req, res) => {
  try {
    const { title, assignee = '', status = 'todo', priority = 'medium' } = req.body || {};

    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'title is required' });
    }

    const task = {
      id: randomUUID(),
      title: title.trim(),
      assignee,
      status,
      priority,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    tasks.push(task);
    broadcast('tasks:update', tasks);

    res.status(201).json(task);
  } catch (error) {
    console.error('Failed to create task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

app.put('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};

    const task = tasks.find((item) => item.id === id);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (typeof status !== 'string' || !status.trim()) {
      return res.status(400).json({ error: 'status is required' });
    }

    task.status = status.trim();
    task.updatedAt = new Date().toISOString();

    broadcast('tasks:update', tasks);

    res.json(task);
  } catch (error) {
    console.error('Failed to update task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existingTask = tasks.find((task) => task.id === id);

    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    tasks = tasks.filter((task) => task.id !== id);
    broadcast('tasks:update', tasks);

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

app.get('/api/agents', async (req, res) => {
  try {
    const { stdout } = await execAsync('openclaw agents list');
    const lines = stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    res.json({ agents: lines });
  } catch (error) {
    console.error('Failed to list agents:', error);
    res.status(500).json({ error: 'Failed to list active agents' });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const byStatus = {};
    const byPriority = {};

    for (const task of tasks) {
      const status = task.status || 'unknown';
      const priority = task.priority || 'unknown';

      byStatus[status] = (byStatus[status] || 0) + 1;
      byPriority[priority] = (byPriority[priority] || 0) + 1;
    }

    res.json({
      total: tasks.length,
      byStatus,
      byPriority,
    });
  } catch (error) {
    console.error('Failed to get stats:', error);
    res.status(500).json({ error: 'Failed to get task stats' });
  }
});

wss.on('connection', (socket) => {
  socket.send(JSON.stringify({ type: 'tasks:init', payload: tasks }));
});

server.listen(PORT, () => {
  console.log(`ClawBoard server listening on http://localhost:${PORT}`);
});
