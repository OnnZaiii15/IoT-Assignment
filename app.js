import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import {
  getDatabase,
  ref,
  onValue,
  set,
  update,
  push,
  query,
  limitToLast
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js';

const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_AUTH_DOMAIN',
  databaseURL: 'YOUR_DATABASE_URL',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_STORAGE_BUCKET',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId: 'YOUR_APP_ID'
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const sensors = [
  { key: 'temperature', label: 'Temperature', unit: '°C', icon: '🌡️' },
  { key: 'humidity', label: 'Humidity', unit: '%', icon: '💧' },
  { key: 'soilMoisture', label: 'Soil Moisture', unit: '%', icon: '🌱' },
  { key: 'lightIntensity', label: 'Light Intensity', unit: 'lx', icon: '☀️' },
  { key: 'waterLevel', label: 'Water Level', unit: '%', icon: '🚰' },
  { key: 'airQuality', label: 'Air Quality', unit: 'AQI', icon: '🍃' },
  { key: 'soilPh', label: 'Soil pH', unit: 'pH', icon: '🧪' },
  { key: 'co2Level', label: 'CO₂ Level', unit: 'ppm', icon: '🧧' }
];

const actuators = [
  { key: 'pump', label: 'Water Pump', icon: '💧' },
  { key: 'growLight', label: 'Grow Light', icon: '💡' },
  { key: 'fan', label: 'Ventilation Fan', icon: '🌬️' },
  { key: 'sprayer', label: 'Nutrient Spray', icon: '🧴' }
];

const state = {
  sensorValues: {},
  actuatorStates: {},
  alerts: [],
  history: { timestamps: [], temperature: [], humidity: [] }
};

let chart;
const chartConfig = {
  type: 'line',
  data: {
    labels: [],
    datasets: [
      {
        label: 'Temperature (°C)',
        borderColor: '#56cc9d',
        backgroundColor: 'rgba(86, 204, 157, 0.24)',
        tension: 0.35,
        pointRadius: 2,
        data: []
      },
      {
        label: 'Humidity (%)',
        borderColor: '#5aa0ff',
        backgroundColor: 'rgba(90, 160, 255, 0.18)',
        tension: 0.35,
        pointRadius: 2,
        data: []
      }
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#d6d9f0' } }
    },
    scales: {
      x: { ticks: { color: '#9ba7cc' }, grid: { color: 'rgba(255,255,255,0.06)' } },
      y: { ticks: { color: '#9ba7cc' }, grid: { color: 'rgba(255,255,255,0.06)' } }
    }
  }
};

function initApp() {
  renderSensorCards();
  renderActuatorPanel();
  renderEmulatorControls();
  setupListeners();
  initChart();
  updateTimestamp();
  setInterval(updateTimestamp, 1000);
  document.getElementById('sendEmulatedData').addEventListener('click', sendEmulatedData);
}

function renderSensorCards() {
  const grid = document.getElementById('sensorGrid');
  grid.innerHTML = '';
  sensors.forEach(sensor => {
    const card = document.createElement('article');
    card.className = 'sensor-card card';
    card.id = `sensor-${sensor.key}`;
    card.innerHTML = `
      <div class="sensor-header">
        <strong>${sensor.icon} ${sensor.label}</strong>
        <div class="sensor-status status-success"><span class="dot"></span>Normal</div>
      </div>
      <div class="sensor-value">
        <strong id="value-${sensor.key}">--</strong>
        <span>${sensor.unit}</span>
      </div>
    `;
    grid.appendChild(card);
  });
}

function renderActuatorPanel() {
  const panel = document.getElementById('actuatorPanel');
  panel.innerHTML = '';
  actuators.forEach(actuator => {
    const card = document.createElement('article');
    card.className = 'actuator-card card';
    card.innerHTML = `
      <div class="actuator-header">
        <strong>${actuator.icon} ${actuator.label}</strong>
        <span id="state-${actuator.key}" class="sensor-status status-success">OFF</span>
      </div>
      <div class="toggle-group">
        <label class="toggle-switch">
          <input type="checkbox" id="toggle-${actuator.key}" />
          <span class="toggle-track"></span>
          <span class="toggle-thumb"></span>
        </label>
        <span class="toggle-label">Toggle ${actuator.label}</span>
      </div>
    `;
    panel.appendChild(card);
    const toggle = card.querySelector('input[type="checkbox"]');
    toggle.addEventListener('change', () => updateActuatorState(actuator.key, toggle.checked));
  });
}

function renderEmulatorControls() {
  const grid = document.getElementById('emulatorGrid');
  grid.innerHTML = '';
  sensors.forEach(sensor => {
    const emulator = document.createElement('article');
    emulator.className = 'emulator-card card';
    emulator.innerHTML = `
      <div class="emulator-header">
        <strong>${sensor.icon} ${sensor.label}</strong>
      </div>
      <label for="input-${sensor.key}">Value (${sensor.unit})</label>
      <input id="input-${sensor.key}" type="range" min="0" max="100" value="50" />
      <input id="input-number-${sensor.key}" type="number" value="50" />
    `;
    grid.appendChild(emulator);
    const range = emulator.querySelector(`#input-${sensor.key}`);
    const number = emulator.querySelector(`#input-number-${sensor.key}`);
    const [min, max, defaultValue] = getEmulatorRange(sensor.key);
    const step = sensor.key === 'soilPh' ? 0.1 : 1;
    range.min = min;
    range.max = max;
    range.step = step;
    range.value = defaultValue;
    number.min = min;
    number.max = max;
    number.step = step;
    number.value = defaultValue;
    range.addEventListener('input', () => { number.value = range.value; });
    number.addEventListener('input', () => { range.value = number.value; });
  });
}

function getEmulatorRange(key) {
  switch (key) {
    case 'temperature': return [10, 45, 24];
    case 'humidity': return [15, 95, 58];
    case 'soilMoisture': return [10, 100, 62];
    case 'lightIntensity': return [0, 1200, 530];
    case 'waterLevel': return [0, 100, 84];
    case 'airQuality': return [0, 200, 42];
    case 'soilPh': return [4, 9, 6.8];
    case 'co2Level': return [250, 1500, 520];
    default: return [0, 100, 50];
  }
}

function setupListeners() {
  onValue(ref(db, 'smart_agriculture/sensors'), snapshot => {
    const sensorData = snapshot.val() || {};
    state.sensorValues = sensorData;
    updateSensorCards(sensorData);
    appendHistory(sensorData);
    updateChart();
    checkAlerts(sensorData);
  });

  onValue(ref(db, 'smart_agriculture/actuators'), snapshot => {
    const actuatorData = snapshot.val() || {};
    state.actuatorStates = actuatorData;
    updateActuatorUI(actuatorData);
  });

  const alertsQuery = query(ref(db, 'smart_agriculture/alerts'), limitToLast(6));
  onValue(alertsQuery, snapshot => {
    const raw = snapshot.val() || {};
    state.alerts = Object.values(raw).sort((a, b) => b.timestamp - a.timestamp);
    renderAlerts(state.alerts);
  });

  onValue(ref(db, '.info/connected'), snapshot => {
    const online = snapshot.val() === true;
    updateConnectionStatus(online);
  });
}

function updateSensorCards(sensorData) {
  sensors.forEach(sensor => {
    const value = sensorData[sensor.key];
    const label = document.getElementById(`value-${sensor.key}`);
    if (label) {
      label.textContent = formatValue(value, sensor.key);
    }
    const card = document.getElementById(`sensor-${sensor.key}`);
    const status = card?.querySelector('.sensor-status');
    if (status) {
      const { label: statusText, level } = getSensorStatus(value, sensor.key);
      status.textContent = statusText;
      status.className = `sensor-status status-${level}`;
    }
  });
}

function updateActuatorUI(actuatorData) {
  actuators.forEach(actuator => {
    const stateValue = actuatorData[actuator.key]?.state;
    const label = document.getElementById(`state-${actuator.key}`);
    const toggle = document.getElementById(`toggle-${actuator.key}`);
    if (label && toggle) {
      const isOn = stateValue === true || stateValue === 'ON';
      label.textContent = isOn ? 'ON' : 'OFF';
      label.className = `sensor-status ${isOn ? 'status-success' : 'status-warning'}`;
      toggle.checked = isOn;
    }
  });
}

function updateActuatorState(key, value) {
  set(ref(db, `smart_agriculture/actuators/${key}`), {
    state: value,
    updatedAt: Date.now()
  });
}

function updateConnectionStatus(online) {
  const badge = document.getElementById('connectionBadge');
  if (!badge) return;
  badge.textContent = online ? 'Online' : 'Offline';
  badge.className = `badge ${online ? 'badge-online' : 'badge-offline'}`;
}

function initChart() {
  const ctx = document.getElementById('trendChart');
  chart = new Chart(ctx, chartConfig);
}

function appendHistory(sensorData) {
  if (!sensorData.temperature || !sensorData.humidity) return;
  const label = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  state.history.timestamps.push(label);
  state.history.temperature.push(sensorData.temperature);
  state.history.humidity.push(sensorData.humidity);
  while (state.history.timestamps.length > 20) {
    state.history.timestamps.shift();
    state.history.temperature.shift();
    state.history.humidity.shift();
  }
}

function updateChart() {
  chart.data.labels = [...state.history.timestamps];
  chart.data.datasets[0].data = [...state.history.temperature];
  chart.data.datasets[1].data = [...state.history.humidity];
  chart.update();
}

function formatValue(value, key) {
  if (value === undefined || value === null) return '--';
  if (key === 'soilPh') return Number(value).toFixed(1);
  if (key === 'temperature' || key === 'co2Level' || key === 'lightIntensity' || key === 'waterLevel' || key === 'soilMoisture') {
    return Number(value).toFixed(0);
  }
  return Number(value).toFixed(1);
}

function getSensorStatus(value, key) {
  if (value === undefined || value === null) return { label: 'Unknown', level: 'warning' };
  const numeric = Number(value);
  switch (key) {
    case 'temperature':
      if (numeric < 16 || numeric > 35) return { label: 'Alert', level: 'danger' };
      if (numeric < 20 || numeric > 30) return { label: 'Warning', level: 'warning' };
      return { label: 'Normal', level: 'success' };
    case 'humidity':
      if (numeric < 30 || numeric > 85) return { label: 'Alert', level: 'danger' };
      if (numeric < 40 || numeric > 75) return { label: 'Warning', level: 'warning' };
      return { label: 'Normal', level: 'success' };
    case 'soilMoisture':
      if (numeric < 20) return { label: 'Dry', level: 'danger' };
      if (numeric < 40) return { label: 'Low', level: 'warning' };
      return { label: 'Good', level: 'success' };
    case 'lightIntensity':
      if (numeric < 200) return { label: 'Low', level: 'warning' };
      return { label: 'Good', level: 'success' };
    case 'waterLevel':
      if (numeric < 20) return { label: 'Refill', level: 'danger' };
      if (numeric < 40) return { label: 'Low', level: 'warning' };
      return { label: 'Good', level: 'success' };
    case 'airQuality':
      if (numeric > 150) return { label: 'Poor', level: 'danger' };
      if (numeric > 100) return { label: 'Fair', level: 'warning' };
      return { label: 'Good', level: 'success' };
    case 'soilPh':
      if (numeric < 5.5 || numeric > 7.5) return { label: 'Alert', level: 'danger' };
      return { label: 'Healthy', level: 'success' };
    case 'co2Level':
      if (numeric > 1200) return { label: 'High', level: 'danger' };
      if (numeric > 800) return { label: 'Elevated', level: 'warning' };
      return { label: 'Normal', level: 'success' };
    default:
      return { label: 'OK', level: 'success' };
  }
}

function renderAlerts(alerts) {
  const list = document.getElementById('alertsList');
  list.innerHTML = '';
  alerts.slice(0, 6).forEach(alert => {
    const item = document.createElement('div');
    item.className = 'alert-card';
    item.innerHTML = `
      <div class="alert-body">
        <strong>${alert.icon || '⚠️'} ${alert.message}</strong>
        <span class="alert-small">${new Date(alert.timestamp).toLocaleString()}</span>
      </div>
      ${alert.isNew ? '<span class="badge-small">NEW</span>' : ''}
    `;
    list.appendChild(item);
  });
}

function checkAlerts(sensorData) {
  const messages = [];
  sensors.forEach(sensor => {
    const value = sensorData[sensor.key];
    const status = getSensorStatus(value, sensor.key);
    if (status.level === 'danger') {
      messages.push(`${sensor.label} is out of safe range (${formatValue(value, sensor.key)} ${sensor.unit})`);
    }
  });
  if (messages.length > 0) {
    messages.forEach(message => pushAlert(message));
  }
}

function pushAlert(message) {
  const alert = {
    message,
    icon: '⚠️',
    timestamp: Date.now(),
    isNew: true
  };
  push(ref(db, 'smart_agriculture/alerts'), alert);
}

function sendEmulatedData() {
  const values = {
    timestamp: Date.now()
  };
  sensors.forEach(sensor => {
    const numberField = document.getElementById(`input-number-${sensor.key}`);
    values[sensor.key] = Number(numberField.value);
  });

  set(ref(db, 'smart_agriculture/sensors'), values);
  checkAlerts(values);
  appendHistory(values);
  updateChart();
}

function updateTimestamp() {
  const element = document.getElementById('timestamp');
  if (element) {
    element.textContent = new Date().toLocaleString();
  }
}

window.addEventListener('DOMContentLoaded', initApp);

