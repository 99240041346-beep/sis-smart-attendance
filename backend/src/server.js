const express = require('express');
const cors = require('cors');
const app = express();
const PORT = Number(process.env.PORT || 4000);

app.use(cors({ origin: true }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'KARE ONE API', phase: 1 });
});

app.listen(PORT, '0.0.0.0', () => console.log('KARE ONE API foundation running on ' + PORT));
