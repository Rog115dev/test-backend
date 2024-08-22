import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';


dotenv.config();

const app = express();
const port = process.env.PORT || 8000;

app.use(cors({
  origin: '*', // Replace with your actual frontend domain
  methods: 'GET,POST,PUT,DELETE,OPTIONS',
  allowedHeaders: 'Origin, X-Requested-With, Content-Type, Accept, x-access-token, Access-Control-Allow-Origin, Access-Control-Allow-Headers, Authorization'
}));

app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.apiKey,
});

let assistant_id = process.env.assistant_id;

const run_finished_states = ['completed', 'failed', 'cancelled', 'expired', 'requires_action'];
dotenv.config();

app.use(express.json());

const db = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'mydatabase',
});

app.get('/', (req, res) => {
 res.send('Hello World########');
});

app.post('/api/new', async (req, res) => {
  try {
    const thread = await openai.beta.threads.create();
    await openai.beta.threads.messages.create(thread.id, {
      content: 'Greet the user and tell it about yourself and ask it what it is looking for.',
      role: 'user',
      metadata: {
        type: 'hidden'
      }
    });
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistant_id
    });


    res.json({
      run_id: run.id,
      thread_id: thread.id,
      status: run.status,
      required_action: run.required_action,
      last_error: run.last_error
    });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get('/api/threads/:thread_id/runs/:run_id', async (req, res) => {
  const { thread_id, run_id } = req.params;
  try {
    const run = await openai.beta.threads.runs.retrieve(thread_id, run_id);
    res.json({
      run_id: run.id,
      thread_id: thread_id,
      status: run.status,
      required_action: run.required_action,
      last_error: run.last_error
    });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post('/api/threads/:thread_id/runs/:run_id/tool', async (req, res) => {
  const { thread_id, run_id } = req.params;
  const { tool_outputs } = req.body;
  try {
    const run = await openai.beta.threads.runs.submitToolOutputs(thread_id, run_id, tool_outputs);
    res.json({
      run_id: run.id,
      thread_id: thread_id,
      status: run.status,
      required_action: run.required_action,
      last_error: run.last_error
    });
  } catch (error) {
    res.status(500).send(error.message);
  }
});
app.get('/api/threads/:thread_id', async (req, res) => {
  const { thread_id } = req.params;
  try {
    const messages = await openai.beta.threads.messages.list(thread_id);
    const result = messages.data.map(message => ({
      content: message.content[0].text.value,
      role: message.role,
      hidden: message.metadata && message.metadata.type === 'hidden',
      id: message.id,
      created_at: message.created_at
    }));
    res.json({
      messages: result
    });
  } catch (error) {
    res.status(500).send(error.message);
  }
});
app.post('/api/threads/:thread_id', async (req, res) => {
  const { thread_id } = req.params;
  const { content } = req.body;
  try {
    await openai.beta.threads.messages.create(thread_id, {
      content: content,
      role: 'user'
    });
    const run = await openai.beta.threads.runs.create(thread_id, {
      assistant_id: assistant_id
    });


    res.json({
      run_id: run.id,
      thread_id: thread_id,
      status: run.status,
      required_action: run.required_action,
      last_error: run.last_error
    });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post('/api/update-assistant-id', (req, res) => {
  const { newAssistantId } = req.body;
  if (!newAssistantId) {
    return res.status(400).send('newAssistantId is required');
  }
  assistant_id = newAssistantId;
  res.send(`Assistant ID updated to ${newAssistantId}`);
});



// API route to get all assistants
app.get('/api/assistants', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM assistants');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API route to create a new assistant
app.post('/api/assistants', async (req, res) => {
  const { assistantId, assistantName } = req.body;
  try {
    const [result] = await db.execute(
      'INSERT INTO assistants (assistantId, assistantName) VALUES (?, ?)',
      [assistantId, assistantName]
    );
    res.status(201).json({ id: result.insertId, assistantId, assistantName });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// API route to create a new assistant
app.post('/api/assistants', async (req, res) => {
  const { assistantId, assistantName } = req.body;

  try {
    // Fetch the maximum current id
    const [rows] = await db.execute('SELECT MAX(id) as maxId FROM assistants');
    const nextId = rows[0].maxId !== null ? rows[0].maxId + 1 : 1; // Calculate the next id

    console.log('Next ID:', nextId); // Debugging log for nextId

    // Insert new assistant with the calculated id
    const [result] = await db.execute(
      'INSERT INTO assistants (id, assistantId, assistantName) VALUES (?, ?, ?)'
      // [nextId, assistantId, assistantName]
    );

    console.log('Insert result:', result); // Debugging log for result
    res.status(201).json({ id: nextId, assistantId, assistantName });
  } catch (error) {
    console.error('Error inserting data:', error.message); // Debugging log for errors
    res.status(500).json({ error: error.message });
  }
});




// API route to update an assistant
app.post('/api/assistants/:id', async (req, res) => {
  const { id } = req.params;
  const { assistantId, assistantName } = req.body;
  try {
    const [result] = await db.execute(
      'UPDATE assistants SET assistantId = ?, assistantName = ? WHERE id = ?',
      [assistantId, assistantName, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Assistant not found' });
    }
    res.json({ id, assistantId, assistantName });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API route to delete an assistant
app.delete('/api/assistants/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.execute('DELETE FROM assistants WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Assistant not found' });
    }
    res.json({ message: 'Assistant deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
