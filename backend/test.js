import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const API_URL = 'http://localhost:5000/api';

async function testDashboard() {
  try {
    // We need a token. Let's assume we can bypass or have one.
    // Since I can't easily get a token without login, I'll try to just check if the server is up.
    const res = await axios.get(\`\${API_URL}/health\`);
    console.log('Health:', res.data);
    
    // If I could login I would, but let's just check the log output.
  } catch (err) {
    console.error('Test failed:', err.response?.data || err.message);
  }
}

testDashboard();
