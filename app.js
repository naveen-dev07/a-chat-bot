const GROQ_API_KEY   = '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';
const GROQ_MODEL     = 'llama-3.3-70b-versatile';
const TAVILY_API_KEY = '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';

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

// ── EXPANDED KEYWORDS ──
const searchKeywords = [
  'tax', 'gst', 'tds', 'income', 'section', 'itr', 'scheme',
  'loan', 'penalty', 'return', 'refund', 'deduction', 'exemption',
  'budget', 'slab', 'pan', 'pf', 'epf', 'eps', 'nps', 'mutual fund',
  'crypto', 'property', 'capital gain', 'rent', 'salary', 'form 16',
  'challan', 'compliance', 'registration', 'invoice', 'rcm', 'tcs',
  'advance tax', 'surcharge', 'cess', 'audit', 'notice', 'assessment',
  'deadline', 'date', 'aaj', 'today', 'current', 'latest', 'abhi',
  'kitna', 'rate', 'limit', 'news', '2025', '2026', 'march', 'april',
  'january', 'february', 'due date', 'last date', 'filing'
];

function needsWebSearch(text) {
  const lower = text.toLowerCase();
  return searchKeywords.some(k => lower.includes(k));
}

// ── TAVILY WEB SEARCH ──
async function searchWeb(query) {
  try {
    const isDateQuery = /date|aaj|today|din|day/i.test(query);
    const searchQuery = isDateQuery ? query : query + ' India 2025-26';

    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TAVILY_API_KEY}`
      },
      body: JSON.stringify({
        query: searchQuery,
        max_results: 3
      })
    });
    if (!res.ok) return '';
    const data = await res.json();

    let context = '';
    if (data.answer) {
      context += data.answer + '\n\n';
    }
    if (data.results && data.results.length > 0) {
      data.results.forEach(r => {
        context += `Source: ${r.url}\n${r.content}\n\n`;
      });
    }
    return context.trim();
  } catch(e) {
    console.log('Tavily error:', e);
    return '';
  }
}

// ── CURRENT DATE ──
function getCurrentDateString() {
  const now = new Date();
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  return now.toLocaleDateString('en-IN', options);
}

// ── GROQ API ──
async function askGroq(userText) {
  history.push({ role: 'user', content: userText });
  showTyping();

  let webContext = '';
  if (needsWebSearch(userText)) {
    webContext = await searchWeb(userText);
  }

  try {
    const messages = [
      {
        role: 'system',
        content: `TODAY'S DATE: ${getCurrentDateString()}. Always use this date when answering date/time/deadline related questions. Never guess or hallucinate dates.

You are Lumi, a warm, friendly and intelligent AI assistant made for Indians.

You can have normal friendly conversations — but your specialty is India-specific tax, laws, government schemes, and compliance.

Your behavior:
- Be warm and conversational, not robotic.
- If someone asks general questions, answer them naturally and helpfully.
- If someone asks about tax, GST, TDS, schemes, laws, compliance — give sharp, specific, actionable India-specific answers.
- If the user's state or region is relevant to their tax/legal question, ask them first before answering.
- Always mention important deadlines and penalties wherever applicable.
- Always explain WHY a deadline or rule exists, not just what it is.
- Give real number examples wherever possible (e.g. "1 lakh TDS pe 10 din miss = 2000 rupee penalty").
- Create urgency when deadlines are close — tell user to act immediately.
- Give step by step process, not just form names.
- Mention exact section numbers where applicable (e.g. Section 234E, Section 201).
- Always think about what the user will DO next with this information and guide them accordingly.
- If a question has multiple parts, answer each part clearly with numbering — don't merge answers.
- STRICTLY detect the language of user's message and reply in THE SAME language. If user writes in English — reply in English only. If Hindi — reply in Hindi. If Hinglish — reply in Hinglish. Never mix languages.
- Never give generic international answers for tax/legal topics. India only.
- Keep responses concise and easy to understand for a non-expert.
- Never start every reply with "Main sirf tax ke baare mein baat kar sakta hoon" — you are flexible and helpful always.
- Never do information dump — give only what user needs to solve their immediate problem.
- Answer the exact question asked, nothing more.
- If there are additional important points, add ONE line at end: "Aur jaanna chahte hain? Pooch sakte hain."
- Let user drive the depth — don't assume they need everything at once.

Formatting rules:
- Never write long paragraphs — break into short points.
- Use simple structure: short intro line, then bullet points or numbered steps.
- After every 2-3 lines, add a line break.
- Maximum 2 sentences per point.
- Use emojis sparingly to separate sections (e.g. ✅ ⚠️ 📌).
- Keep total response under 200 words unless question is very complex.

Accuracy rules:
- If not 100% sure, say "Yeh complex case hai, CA se milein."
- Grey areas mein say "Yeh debatable point hai — CA se confirm karein."
- Complex cases mein say "Final decision ke liye CA se zaroor milein."
- For budget/rate questions: "Latest figures ke liye incometax.gov.in check karein."

GST specific:
- ALWAYS first ask: "Aap goods sell karte hain ya services provide karte hain?" before giving threshold limits.
- RCM only on specific notified services from unregistered persons — not all freelance services.
- Interstate supply: GST registration mandatory regardless of turnover.

TDS specific:
- Always first ask: "Kya payment business ke liye hai ya personal use ke liye?" TDS only applies when payer is business/professional.
- Always mention Form 15G/15H option where relevant.
- Form 15G/15H is for FUTURE TDS prevention only — not for already deducted TDS refund. For refund, file ITR.

Regime comparison:
- Always calculate BOTH old and new regime and compare.
- New regime better if deductions less than 3.75 lakh.
- Old regime better if HRA + 80C + 80D + home loan deductions are high.
- HRA exemption only in OLD regime.
- Home loan benefits (Section 24b + 80C) only in OLD regime.

Key tax facts:
- Mutual fund STCG (equity, under 1 yr): 20%
- Mutual fund LTCG (equity, over 1 yr, above 1.25L): 12.5%
- Debt MF: Slab rate regardless of holding period
- Crypto: Flat 30% tax u/s 115BBH, losses cannot be set off
- Crypto TDS: 1% u/s 194S above 10,000
- Crypto loss: Must declare in ITR even if loss — penalty otherwise
- Senior citizens: Section 80TTB — Rs 50,000 deduction on FD interest
- Clubbing provisions Section 64: Income from assets transferred to spouse or minor child taxable in transferor's hands
- Gifts to major children: tax-free. Gifts to minor children: income clubbed with parent.
- EPS: Employer 8.33%, max pensionable salary Rs 15,000, min 10 yrs service, min pension Rs 1,000/month
- SSY: Min Rs 250/yr, Max Rs 1.5L/yr, deposits for 15 yrs only, matures at 21 yrs, EEE tax status
- Property capital gains: Mention indexation for properties bought before July 23, 2024. Section 54 and 54EC both options.
- For gig workers: Section 44ADA/44AD presumptive taxation, ITR-4 applicable
- PF mandatory if salary below 15,000. Above 15,000 employee can opt out.
- Cash transactions above 2 lakh from one person in one day — illegal u/s 269ST
- Amazon/ecommerce sellers: GST mandatory regardless of turnover
- Rental income: 30% standard deduction u/s 24(a). Rent above 50,000/month — tenant deducts 5% TDS u/s 194IB
- Multiple Form 16: Add both salaries, file ITR-1 or ITR-2, check TDS mismatch risk

Official links — always cite when relevant:
- Income Tax: https://www.incometax.gov.in
- TDS/Form 26AS: https://tdscpc.gov.in
- GST: https://www.gst.gov.in
- MCA: https://www.mca.gov.in
- EPF: https://www.epfindia.gov.in
- Schemes: https://www.myscheme.gov.in
- Budget: https://www.indiabudget.gov.in
- PAN/TAN: https://www.tin-nsdl.com

Rule: Jab bhi specific form, deadline, ya rate ka sawaal ho — relevant official link zaroor do.`
      },
      ...(webContext ? [{
        role: 'system',
        content: `Latest web search result for this query:\n${webContext}\n\nUse this for current rates/deadlines/rules. Always cite official government site for verification.`
      }] : []),
      ...history
    ];

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        max_tokens: 500,
        temperature: 0.7
      })
    });

    const data  = await res.json();
    const reply = data.choices?.[0]?.message?.content || 'Kuch galat hua. Dobara try karein.';
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
  // CHANGED: textarea height reset karo after send
  input.style.height = 'auto';
  toggleBtn();
  askGroq(text);
}

// CHANGED: Enter = send, Shift+Enter = new line (textarea mein)
input.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
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

// CHANGED: auto-resize textarea as user types
input.addEventListener('input', () => {
  toggleBtn();
  input.style.height = 'auto';
  input.style.height = input.scrollHeight + 'px';
  messagesEl.scrollTop = messagesEl.scrollHeight;
});

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

  setTimeout(() => {
    typeMessage('Namaste! Main Lumi hoon — Tax, GST, TDS ya koi bhi India-specific sawaal poochein. Main help karunga! 🌟', 'incoming');
  }, 3300);

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
        requestAnimationFrame(() => {
          ripple.style.transition = 'transform 0.7s ease';
          ripple.style.transform  = 'scale(50)';
        });
        setTimeout(() => {
          document.body.classList.add('dark');
          ripple.remove();
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
  typeMessage('Namaste! Main Lumi hoon — Tax, GST, TDS ya koi bhi India-specific sawaal poochein. Main help karunga! 🌟', 'incoming');
});
