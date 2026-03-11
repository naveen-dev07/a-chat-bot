const GROQ_API_KEY = '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';
const GROQ_MODEL   = 'llama-3.3-70b-versatile';

let voiceMode   = false;
let recognition = null;

// ── STARTUP ANIMATION ──
window.addEventListener('load', () => {
  const intro = document.getElementById('intro');
  const app   = document.getElementById('app');
  setTimeout(() => {
    intro.style.opacity    = '0';
    intro.style.transition = 'opacity 0.6s ease';
    setTimeout(() => {
      intro.style.display = 'none';
      app.style.opacity   = '1';
      app.classList.add('revealed');
    }, 600);
  }, 2800);
});

// ── WAVE ICON ──
const waveHTML = `<svg class="wave-icon" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M2 10v3"/><path d="M6 6v11"/>
  <path d="M10 3v18"/><path d="M14 8v7"/>
  <path d="M18 5v13"/><path d="M22 10v3"/>
</svg>`;

const history    = [];
const messagesEl = document.getElementById('messages');

// ── ADD MESSAGE (instant) ──
function addMessage(text, type) {
  const row    = document.createElement('div');
  row.className = 'msg-row ' + type;
  const bubble  = document.createElement('div');
  bubble.className = 'bubble ' + type;
  bubble.textContent = text;
  const wave   = document.createElement('span');
  wave.innerHTML = waveHTML;
  if (type === 'incoming') {
    row.appendChild(wave.firstElementChild);
    row.appendChild(bubble);
  } else {
    row.appendChild(bubble);
    row.appendChild(wave.firstElementChild);
  }
  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ── TYPEWRITER (AI only) ──
function typeMessage(text, type) {
  const row    = document.createElement('div');
  row.className = 'msg-row ' + type;
  const bubble  = document.createElement('div');
  bubble.className = 'bubble ' + type;
  const wave   = document.createElement('span');
  wave.innerHTML = waveHTML;
  if (type === 'incoming') {
    row.appendChild(wave.firstElementChild);
    row.appendChild(bubble);
  } else {
    row.appendChild(bubble);
    row.appendChild(wave.firstElementChild);
  }
  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  let i = 0;
  const interval = setInterval(() => {
    bubble.textContent += text[i];
    i++;
    messagesEl.scrollTop = messagesEl.scrollHeight;
    if (i >= text.length) clearInterval(interval);
  }, 18);
}

// ── TYPING INDICATOR ──
function showTyping() {
  const row = document.createElement('div');
  row.className = 'msg-row incoming';
  row.id = 'typing-row';
  const wave = document.createElement('span');
  wave.innerHTML = waveHTML;
  row.appendChild(wave.firstElementChild);
  const dots = document.createElement('div');
  dots.className = 'typing-dots';
  dots.innerHTML = '<span></span><span></span><span></span>';
  row.appendChild(dots);
  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}
function hideTyping() {
  const el = document.getElementById('typing-row');
  if (el) el.remove();
}

// ── SPLIT TEXT INTO CHUNKS ──
function splitIntoChunks(text, maxLen = 180) {
  const sentences = text.match(/[^.!?]+[.!?]*/g) || [text];
  const chunks = [];
  let current = '';
  for (const s of sentences) {
    if ((current + s).length <= maxLen) {
      current += s;
    } else {
      if (current) chunks.push(current.trim());
      current = s;
    }
  }
  if (current) chunks.push(current.trim());
  return chunks;
}

// ── SPEAK ONE CHUNK ──
async function speakChunk(text) {
  const res = await fetch('https://api.groq.com/openai/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: 'canopylabs/orpheus-v1-english',
      input: text,
      voice: 'hannah',
      response_format: 'wav'
    })
  });
  if (!res.ok) {
    const errText = await res.text();
    console.log('TTS Error:', errText);
    return;
  }
  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  return new Promise(resolve => {
    const audio = new Audio(url);
    audio.onended = resolve;
    audio.onerror = resolve;
    audio.play().catch(resolve);
  });
}

// ── SPEAK FULL TEXT ──
async function speak(text) {
  if (!voiceMode) return;
  const chunks = splitIntoChunks(text, 180);
  for (const chunk of chunks) {
    if (chunk.trim()) await speakChunk(chunk);
  }
}

// ── GROQ API ──
async function askGroq(userText) {
  history.push({ role: 'user', content: userText });
  showTyping();
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: 'You are Lumi, a warm and thoughtful AI assistant. Keep responses concise and clear.' },
          ...history
        ],
        max_tokens: 500,
        temperature: 0.7
      })
    });
    const data  = await res.json();
    const reply = data.choices?.[0]?.message?.content || 'Something went wrong. Please try again.';
    history.push({ role: 'assistant', content: reply });
    hideTyping();
    typeMessage(reply, 'incoming');
    speak(reply);
  } catch(e) {
    hideTyping();
    typeMessage('Network error. Please try again.', 'incoming');
  }
}

// ── SEND ──
const input     = document.getElementById('msgInput');
const actionBtn = document.getElementById('actionBtn');
const micIcon   = document.getElementById('micIcon');
const sendIcon  = document.getElementById('sendIcon');

function handleSend() {
  const text = input.value.trim();
  if (!text) return;
  addMessage(text, 'outgoing');
  input.value = '';
  toggleBtn();
  askGroq(text);
}

input.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
});

// ── SMART BUTTON TOGGLE ──
function toggleBtn() {
  if (input.value.length > 0) {
    micIcon.style.display  = 'none';
    sendIcon.style.display = 'block';
  } else {
    micIcon.style.display  = 'block';
    sendIcon.style.display = 'none';
  }
}
input.addEventListener('input', toggleBtn);

actionBtn.addEventListener('click', () => {
  if (input.value.trim().length > 0) handleSend();
  else startVoice();
});

// ── VOICE INPUT ──
function startVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { typeMessage('Voice not supported.', 'incoming'); return; }
  if (recognition) { recognition.stop(); return; }
  recognition = new SR();
  recognition.lang            = 'hi-IN';
  recognition.interimResults  = false;
  recognition.maxAlternatives = 1;
  recognition.continuous      = false;
  actionBtn.classList.add('listening');
  recognition.onresult = e => {
    const transcript = e.results[0][0].transcript;
    input.value = transcript;
    toggleBtn();
    recognition = null;
    actionBtn.classList.remove('listening');
    handleSend();
  };
  recognition.onerror = () => {
    recognition = null;
    actionBtn.classList.remove('listening');
  };
  recognition.onend = () => {
    recognition = null;
    actionBtn.classList.remove('listening');
  };
  setTimeout(() => {
    try { recognition.start(); }
    catch(e) { recognition = null; actionBtn.classList.remove('listening'); }
  }, 500);
}

// ── ALL LOAD EVENTS ──
window.addEventListener('load', () => {

  // Initial greeting
  setTimeout(() => {
    typeMessage('Namaste! Main Lumi hoon —Aap kya jaanna chahte hain? 🌟', 'incoming');
  }, 3300);

  // Audio toggle
  const audioBtn = document.querySelector('[title="Audio"]');
  if (audioBtn) {
    audioBtn.addEventListener('click', () => {
      voiceMode = !voiceMode;
      if (voiceMode) {
        audioBtn.style.background   = 'hsl(0 0% 100% / 0.25)';
        audioBtn.style.borderRadius = '0.6rem';
        audioBtn.style.border       = '1px solid hsl(0 0% 100% / 0.5)';
        audioBtn.style.boxShadow    = '0 0 10px rgba(142,202,230,0.5)';
      } else {
        audioBtn.style.background = 'none';
        audioBtn.style.border     = 'none';
        audioBtn.style.boxShadow  = 'none';
      }
    });
  }

  // Dark mode toggle
  const menuBtn = document.querySelector('[title="Menu"]');
  if (menuBtn) {
    menuBtn.addEventListener('click', () => {
      const isDark = document.body.classList.contains('dark');
      const ripple = document.createElement('div');
      ripple.className = 'dark-ripple';
      const rect = menuBtn.getBoundingClientRect();
      ripple.style.width  = '20px';
      ripple.style.height = '20px';
      ripple.style.left   = rect.left + 'px';
      ripple.style.top    = rect.top + 'px';
      document.body.appendChild(ripple);

      if (!isDark) {
        // Light → Dark: ripple expand
        requestAnimationFrame(() => {
          ripple.style.transition = 'transform 0.7s ease';
          ripple.style.transform  = 'scale(50)';
        });
        setTimeout(() => {
          document.body.classList.add('dark');
          ripple.remove();
          // Icon change — sun
          menuBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="5"/>
            <line x1="12" y1="1" x2="12" y2="3"/>
            <line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/>
            <line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>`;
        }, 700);
      } else {
        // Dark → Light: fade out
        ripple.style.transform    = 'scale(50)';
        ripple.style.transition   = 'none';
        ripple.style.borderRadius = '0';
        ripple.style.width        = '100vw';
        ripple.style.height       = '100vh';
        ripple.style.left         = '0';
        ripple.style.top          = '0';
        ripple.style.opacity      = '1';
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            ripple.style.transition = 'opacity 0.8s ease';
            ripple.style.opacity    = '0';
            document.body.classList.remove('dark');
          });
        });
        setTimeout(() => {
          ripple.remove();
          // Icon change — moon
          menuBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>`;
        }, 900);
      }
    });
  }

});

// ── NEW CHAT ──
document.getElementById('btn-new').addEventListener('click', () => {
  messagesEl.innerHTML = '';
  history.length = 0;
  typeMessage('Namaste! Main Lumi hoon — Aap kya jaanna chahte hain? 🌟', 'incoming');
});
