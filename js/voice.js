// ─── RECONOCIMIENTO DE VOZ → MÉTRICAS ────────────────────────────────────────
// Usa la Web Speech API nativa del browser (Chrome / Edge).
// Sin costo, sin API key, funciona offline en Chrome.

let recognition   = null;
let isListening   = false;
let finalTranscript = '';

function iniciarVoz(onResult, onError) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    onError('Tu browser no soporta reconocimiento de voz. Usá Chrome o Edge.');
    return false;
  }

  recognition = new SpeechRecognition();
  recognition.lang = 'es-AR';
  recognition.continuous = true;        // escucha hasta que el usuario detiene
  recognition.interimResults = true;    // muestra texto mientras habla
  recognition.maxAlternatives = 1;

  finalTranscript = '';

  recognition.onstart = function() {
    isListening = true;
    setMicState('recording');
  };

  recognition.onresult = function(event) {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript + ' ';
      } else {
        interim += transcript;
      }
    }
    updateTranscriptDisplay(finalTranscript, interim);
  };

  recognition.onerror = function(event) {
    isListening = false;
    setMicState('idle');
    if (event.error === 'not-allowed') {
      onError('Permiso de micrófono denegado. Habilitalo en la configuración del browser.');
    } else if (event.error === 'no-speech') {
      onError('No se detectó voz. Intentá de nuevo.');
    } else {
      onError('Error de reconocimiento: ' + event.error);
    }
  };

  recognition.onend = function() {
    isListening = false;
    setMicState('idle');
    if (finalTranscript.trim()) {
      onResult(finalTranscript.trim());
    }
  };

  recognition.start();
  return true;
}

function detenerVoz() {
  if (recognition && isListening) {
    recognition.stop();
  }
}

// ── UI del micrófono ──────────────────────────────────────────────────────────

function setMicState(state) {
  // Maneja ambos botones: panel desktop y bottom nav mobile
  const btn    = document.getElementById('mic-btn') || document.getElementById('mic-btn-panel');
  const status = document.getElementById('mic-status');
  if (!btn) return;

  btn.classList.remove('mic-idle', 'mic-recording');
  btn.classList.add('mic-' + state);

  if (state === 'recording') {
    btn.innerHTML = iconStop();
    if (status) status.textContent = 'Escuchando... hablá con naturalidad';
  } else {
    btn.innerHTML = iconMic();
    if (status) status.textContent = 'Presioná para hablar';
  }
}

function updateTranscriptDisplay(final, interim) {
  const el = document.getElementById('voice-transcript');
  if (!el) return;
  el.innerHTML =
    `<span class="transcript-final">${escapeHtml(final)}</span>` +
    `<span class="transcript-interim">${escapeHtml(interim)}</span>`;
}

function iconMic() {
  return `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="22"/>
    <line x1="8"  y1="22" x2="16" y2="22"/>
  </svg>`;
}

function iconStop() {
  return `<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
    <rect x="5" y="5" width="14" height="14" rx="2"/>
  </svg>`;
}
