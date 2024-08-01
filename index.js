import express from 'express';
import cors from 'cors';
import OpenAI from "openai";
import dotenv from 'dotenv';
dotenv.config();
const app = express();
const port = process.env.PORT || 8000;

app.use(cors({
  origin: '*',
  credentials: true,
  methods: '*',
  allowedHeaders: '*'
}));
app.use(express.json());
const openai = new OpenAI({
    apiKey: process.env.apiKey,
  });
 

const assistant_id = process.env.assistant_id;
const run_finished_states = ['completed', 'failed', 'cancelled', 'expired', 'requires_action'];

app.get('/', (req, res) => {
    res.send('Hello World!');
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

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
