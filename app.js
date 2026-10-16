const BASE_URL = 'http://localhost:8769';
const TOKEN_KEY = 'sharp_platform_token';
const USER_KEY = 'sharp_platform_user';
const UPLOADED_FILES_KEY = 'uploaded_files';
const DEVICE_ID_KEY = 'sharp_platform_device_id';

const loginView = document.getElementById('loginView');
const registerView = document.getElementById('registerView');
const homeView = document.getElementById('homeView');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const mobileInput = document.getElementById('mobile');
const passwordInput = document.getElementById('password');
const welcomeText = document.getElementById('welcomeText');
const logoutBtn = document.getElementById('logoutBtn');
const uploadBtn = document.getElementById('uploadBtn');
const uploadStatus = document.getElementById('uploadStatus');
const sendMessageBtn = document.getElementById('sendMessageBtn');
const sendMessage2Btn = document.getElementById('sendMessage2Btn');
const stompMessageInput = document.getElementById('stompMessageInput');
const sendMessageStatus = document.getElementById('sendMessageStatus');
const fileList = document.getElementById('fileList');
const groupIdInput = document.getElementById('groupId');
const groupNameInput = document.getElementById('groupName');
const uploadFileInput = document.getElementById('uploadFile');
const goRegisterLink = document.getElementById('goRegisterLink');
const goLoginLink = document.getElementById('goLoginLink');

const captchaInput = document.getElementById('captchaInput');
const captchaImage = document.getElementById('captchaImage');
const refreshCaptchaBtn = document.getElementById('refreshCaptchaBtn');
const dialogOverlay = document.getElementById('dialogOverlay');
const dialogTitle = document.getElementById('dialogTitle');
const dialogMessage = document.getElementById('dialogMessage');
const dialogCloseBtn = document.getElementById('dialogCloseBtn');
let _lastCaptchaUrl = null;

const smsCodeInput = document.getElementById('smsCodeInput');
const getSmsBtn = document.getElementById('getSmsBtn');
const smsLoginBtn = document.getElementById('smsLoginBtn');
const smsStatus = document.getElementById('smsStatus');

const registerNicknameInput = document.getElementById('registerNickname');
const registerMobileInput = document.getElementById('registerMobile');
const registerPasswordInput = document.getElementById('registerPassword');
const registerCodeInput = document.getElementById('registerCodeInput');
const getRegisterSmsBtn = document.getElementById('getRegisterSmsBtn');
const registerStatus = document.getElementById('registerStatus');

const erpBtn = document.getElementById('erpBtn');
const erpStatus = document.getElementById('erpStatus');
const erpData = document.getElementById('erpData');

const erpBtn2 = document.getElementById('erpBtn2');
const erpStatus2 = document.getElementById('erpStatus2');
const erpData2 = document.getElementById('erpData2');


let stompClient = null;
let smsCountdownTimer = null;
let registerCountdownTimer = null;

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

function getDeviceId() {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = `${Date.now()}${Math.random().toString(10).slice(2, 10)}`;
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

function getStoredUser() {
  const rawUser = localStorage.getItem(USER_KEY);
  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser);
  } catch (error) {
    console.error('Failed to parse user profile', error);
    return null;
  }
}

function getUploadedFiles() {
  try {
    const rawFiles = localStorage.getItem(UPLOADED_FILES_KEY);
    return rawFiles ? JSON.parse(rawFiles) : [];
  } catch (error) {
    console.error('Failed to parse uploaded files', error);
    return [];
  }
}

function saveUploadedFiles(files) {
  localStorage.setItem(UPLOADED_FILES_KEY, JSON.stringify(files));
}

function startCountdown(button, seconds, defaultText, suffix = 's', timerKey = null) {
  if (!button) return;

  if (timerKey) {
    const existingTimer = timerKey === 'sms' ? smsCountdownTimer : registerCountdownTimer;
    if (existingTimer) {
      window.clearTimeout(existingTimer);
    }
  }

  let remaining = seconds;
  button.disabled = true;
  const tick = () => {
    button.textContent = `${remaining}${suffix}`;
    remaining -= 1;
    if (remaining < 0) {
      button.disabled = false;
      button.textContent = defaultText;
      if (timerKey === 'sms') smsCountdownTimer = null;
      if (timerKey === 'register') registerCountdownTimer = null;
      return;
    }
    const timer = window.setTimeout(tick, 1000);
    if (timerKey === 'sms') smsCountdownTimer = timer;
    if (timerKey === 'register') registerCountdownTimer = timer;
  };
  tick();
}

function showLoginView() {
  loginView.classList.remove('hidden');
  registerView.classList.add('hidden');
}

function showRegisterView() {
  loginView.classList.add('hidden');
  registerView.classList.remove('hidden');
}

function renderApp() {
  const token = getToken();
  const isLoggedIn = Boolean(token);
  loginView.classList.toggle('hidden', isLoggedIn);
  registerView.classList.add('hidden');
  homeView.classList.toggle('hidden', !isLoggedIn);

  if (isLoggedIn) {
    const user = getStoredUser();
    const displayName = user?.nickname || user?.mobile || '用户';
    welcomeText.textContent = `欢迎，${displayName}`;
    renderUploadedFiles();
  }
}

function showToast(message) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 5000);
}

function showMessageDialog(title, message) {
  if (!dialogOverlay || !dialogTitle || !dialogMessage || !dialogCloseBtn) {
    showToast(message || title || '提示');
    return;
  }

  dialogTitle.textContent = title || '提示';
  dialogMessage.textContent = message || '';
  dialogOverlay.classList.remove('hidden');
}

function closeMessageDialog() {
  if (dialogOverlay) {
    dialogOverlay.classList.add('hidden');
  }
}

if (dialogOverlay) {
  dialogOverlay.addEventListener('click', (event) => {
    if (event.target === dialogOverlay) {
      closeMessageDialog();
    }
  });
}

async function logout() {
  const token = getToken();

  if (token) {
    try {
      await fetch(`${BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (error) {
      console.warn('Logout request failed, proceeding to local logout', error);
    }
  }

  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(UPLOADED_FILES_KEY);

  if (stompClient && stompClient.connected) {
    stompClient.disconnect(() => {
      stompClient = null;
    });
  }

  showLoginView();
  renderApp();
  showToast('已退出登录');
}

async function login() {
  const mobile = mobileInput.value.trim();
  const password = passwordInput.value.trim();
  const captchaCode = captchaInput && captchaInput.value ? captchaInput.value.trim() : '';

  if (!mobile || !password) {
    showMessageDialog('提示', '请输入手机号和密码');
    return;
  }

  try {
    const deviceId = getDeviceId();
    const payload = { mobile, password, deviceId };
    if (captchaCode) {
      payload.captcha = captchaCode;
    }

    const response = await fetch(`${BASE_URL}/auth/login?code=${encodeURIComponent(captchaCode)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        deviceId,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || '登录失败');
    }

    const data = await response.json();
    const token = data.token;

    if (!token) {
      throw new Error('登录成功但未返回 token');
    }

    localStorage.setItem(TOKEN_KEY, token);
    if (data.user) {
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    }

    renderApp();
    connectMessageSocket(token);
    showToast('登录成功');
  } catch (error) {
    console.error('Login failed', error);
    showMessageDialog('登录失败', error.message || '登录失败');
  }
}

async function fetchCaptcha() {
  const deviceId = getDeviceId();
  try {
    const resp = await fetch(`${BASE_URL}/image/login`, {
      method: 'GET',
      headers: {
        deviceId,
      },
    });

    if (!resp.ok) {
      throw new Error('获取验证码失败');
    }

    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);

    if (_lastCaptchaUrl) {
      try {
        URL.revokeObjectURL(_lastCaptchaUrl);
      } catch (error) {
        // ignore revoke failure
      }
    }
    _lastCaptchaUrl = url;
    captchaImage.src = url;
  } catch (error) {
    console.warn('fetchCaptcha error', error);
    captchaImage.removeAttribute('src');
    showToast(error.message || '无法加载验证码');
  }
}

function connectMessageSocket(token) {
  if (!token) {
    return;
  }

  if (stompClient && stompClient.connected) {
    stompClient.disconnect();
  }

  const messageUrl = `${BASE_URL}/api/platform`;
  const socket = new SockJS(`${messageUrl}/ws/message?access_token=${encodeURIComponent(token)}`);
  stompClient = Stomp.over(socket);

  stompClient.connect(
    {},
    () => {
      stompClient.subscribe('/user/queue/message', (message) => {
        let payload = message.body;

        try {
          payload = JSON.parse(payload);
        } catch (error) {
          // Ignore JSON parse failure and use the raw string payload.
        }

        const text = typeof payload === 'string'
          ? payload
          : payload?.message || payload?.content || payload?.data || JSON.stringify(payload);

        showToast(text || '收到一条新消息');
      });
      showToast('消息推送连接成功');
    },
    (error) => {
      console.error('WebSocket connect error', error);
      showToast('消息推送连接失败');
    },
  );
}

async function uploadFile() {
  const token = getToken();
  const siteId = groupIdInput.value.trim() || '999';
  const groupName = groupNameInput.value.trim() || 'upload';
  const file = uploadFileInput.files[0];

  if (!token) {
    showToast('请先登录');
    return;
  }

  if (!file) {
    showToast('请选择要上传的文件');
    return;
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('groupName', groupName);

  uploadStatus.textContent = '上传中...';

  try {
    const response = await fetch(`${BASE_URL}/api/site/${siteId}/documents/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const rawError = await response.text();
      throw new Error(rawError || '上传失败');
    }

    const result = await response.json();
    const rows = Array.isArray(result?.data) ? result.data : [];

    if (!rows.length) {
      throw new Error('上传成功，但未返回文件信息');
    }

    const currentFiles = getUploadedFiles();
    const nextFiles = [...currentFiles, ...rows.filter((item) => item?.url)];
    saveUploadedFiles(nextFiles);

    uploadStatus.textContent = '上传成功';
    uploadFileInput.value = '';
    renderUploadedFiles();
    showToast('文件上传成功');
  } catch (error) {
    console.error('File upload failed', error);
    uploadStatus.textContent = error.message || '上传失败';
    showToast(error.message || '上传失败');
  }
}

function renderUploadedFiles() {
  const files = getUploadedFiles();
  fileList.innerHTML = '';

  if (!files.length) {
    fileList.innerHTML = '<li><span>暂无文件</span></li>';
    return;
  }

  files.forEach((item) => {
    if (!item?.url) {
      return;
    }

    const itemNode = document.createElement('li');
    itemNode.innerHTML = `
      <span>${item.fullName || item.name || '文件'}</span>
      <a href="${item.url}" target="_blank" rel="noopener noreferrer">下载</a>
    `;
    fileList.appendChild(itemNode);
  });
}

async function sendTestMessage() {
  const token = getToken();

  if (!token) {
    showToast('请先登录');
    return;
  }

  sendMessageStatus.textContent = '发送中...';

  try {
    const response = await fetch(`${BASE_URL}/api/platform/users/messages`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const rawError = await response.text();
      throw new Error(rawError || '发送失败');
    }

    const result = await response.text();
    sendMessageStatus.textContent = result || '消息获取成功';
    showToast('消息获取成功');
  } catch (error) {
    const message = error.message || '发送失败';
    sendMessageStatus.textContent = message;
    showToast(message);
  }
}

async function fetchErpCurrentPlant() {
  const token = getToken();
  if (!token) {
    showToast('请先登录');
    if (erpStatus) erpStatus.textContent = '请先登录';
    return;
  }

  if (erpStatus) erpStatus.textContent = '加载中...';
  if (erpData) erpData.textContent = '';

  try {
    const resp = await fetch(`${BASE_URL}/api/erp/999/plants/current`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(txt || `请求失败: ${resp.status}`);
    }

    const text = await resp.text();
    if (erpData) erpData.textContent = text;
    if (erpStatus) erpStatus.textContent = '加载成功';
    showToast('ERP 数据加载成功');
  } catch (error) {
    console.error('fetchErpCurrentPlant failed', error);
    if (erpStatus) erpStatus.textContent = error.message || '加载失败';
    if (erpData) erpData.textContent = '';
    showToast(error.message || '加载 ERP 数据失败');
  }
}

async function fetchErpPermissionData() {
  const token = getToken();
  if (!token) {
    showToast('请先登录');
    if (erpStatus2) erpStatus2.textContent = '请先登录';
    return;
  }

  if (erpStatus2) erpStatus2.textContent = '加载中...';
  if (erpData2) erpData2.textContent = '';

  try {
    const resp = await fetch(`${BASE_URL}/api/erp/999/plants/permission`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
         Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    });

    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(txt || `请求失败: ${resp.status}`);
    }

    const text = await resp.text();
    if (erpData2) erpData2.textContent = text;
    if (erpStatus2) erpStatus2.textContent = '加载成功';
    showToast('ERP 数据加载成功');
  } catch (error) {
    console.error('fetchErpPermissionData failed', error);
    if (erpStatus2) erpStatus2.textContent = error.message || '加载失败';
    if (erpData2) erpData2.textContent = '';
    showToast(error.message || '加载 ERP 数据失败');
  }
}

function sendMessageViaStomp() {
  if (!stompClient || !stompClient.connected) {
    showToast('消息通道未连接');
    sendMessageStatus.textContent = '消息通道未连接';
    return;
  }

  const payload = (stompMessageInput.value || '').trim();
  if (!payload) {
    showToast('请输入消息内容');
    sendMessageStatus.textContent = '请输入消息内容';
    return;
  }

  stompClient.send('/app/echo', {}, payload);
  sendMessageStatus.textContent = `已通过 STOMP 发送消息：${payload}`;
  showToast('已发送 STOMP 消息');
}

async function requestSmsCode() {
  const mobile = (mobileInput.value || '').trim();
  if (!mobile) {
    showToast('请输入手机号以获取短信验证码');
    smsStatus.textContent = '请输入手机号';
    return;
  }

  const deviceId = getDeviceId();
  const token = getToken();

  getSmsBtn.disabled = true;
  getSmsBtn.textContent = '发送中...';
  smsStatus.textContent = '';

  try {
    const headers = { deviceId };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const resp = await fetch(`${BASE_URL}/sms/${encodeURIComponent(mobile)}/mobile_login`, {
      method: 'GET',
      headers,
    });

    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(txt || '获取验证码失败');
    }

    smsStatus.textContent = '验证码已发送';
    showToast('验证码已发送');
    startCountdown(getSmsBtn, 60, '获取验证码', 's', 'sms');
  } catch (error) {
    console.error('requestSmsCode failed', error);
    smsStatus.textContent = error.message || '获取验证码失败';
    showToast(error.message || '获取验证码失败');
    getSmsBtn.disabled = false;
    getSmsBtn.textContent = '获取验证码';
  }
}

async function mobileLoginWithCode() {
  const mobile = (mobileInput.value || '').trim();
  const code = (smsCodeInput.value || '').trim();

  if (!mobile || !code) {
    showToast('请输入手机号和短信验证码');
    smsStatus.textContent = '请输入手机号和验证码';
    return;
  }

  const deviceId = getDeviceId();

  smsLoginBtn.disabled = true;
  smsLoginBtn.textContent = '登录中...';

  try {
    const resp = await fetch(`${BASE_URL}/auth/mobile_login?mobile=${mobile}&code=${encodeURIComponent(code)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        deviceId,
      },
      body: JSON.stringify({ mobile, password: code }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(txt || '短信登录失败');
    }

    const data = await resp.json();
    const token = data.token;
    if (!token) throw new Error('未返回 token');

    localStorage.setItem(TOKEN_KEY, token);
    if (data.user) localStorage.setItem(USER_KEY, JSON.stringify(data.user));

    smsStatus.textContent = '登录成功';
    showToast('登录成功');
    renderApp();
    connectMessageSocket(token);
  } catch (error) {
    console.error('mobileLoginWithCode failed', error);
    smsStatus.textContent = error.message || '短信登录失败';
    showToast(error.message || '短信登录失败');
  } finally {
    smsLoginBtn.disabled = false;
    smsLoginBtn.textContent = '使用短信登录';
  }
}

async function requestRegisterSmsCode() {
  const mobile = (registerMobileInput.value || '').trim();
  if (!mobile) {
    registerStatus.textContent = '请输入手机号';
    showToast('请输入手机号');
    return;
  }

  getRegisterSmsBtn.disabled = true;
  getRegisterSmsBtn.textContent = '发送中...';

  try {
    const resp = await fetch(`${BASE_URL}/sms/${encodeURIComponent(mobile)}/register`, {
      method: 'GET',
      headers: {
        deviceId: getDeviceId(),
      },
    });

    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(txt || '获取注册验证码失败');
    }

    registerStatus.textContent = '注册验证码已发送';
    showToast('注册验证码已发送');
    startCountdown(getRegisterSmsBtn, 60, '获取验证码', 's', 'register');
  } catch (error) {
    registerStatus.textContent = error.message || '获取注册验证码失败';
    showToast(error.message || '获取注册验证码失败');
    getRegisterSmsBtn.disabled = false;
    getRegisterSmsBtn.textContent = '获取验证码';
  }
}

async function registerUser(event) {
  event.preventDefault();

  const nickname = (registerNicknameInput.value || '').trim();
  const mobile = (registerMobileInput.value || '').trim();
  const password = (registerPasswordInput.value || '').trim();
  const code = (registerCodeInput.value || '').trim();

  if (!nickname || !mobile || !password || !code) {
    registerStatus.textContent = '请填写昵称、手机号、密码和注册验证码';
    showToast('请填写完整注册信息');
    return;
  }

  try {
    const resp = await fetch(`${BASE_URL}/auth/register?mobile=${encodeURIComponent(mobile)}&code=${encodeURIComponent(code)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        deviceId: getDeviceId(),
      },
      body: JSON.stringify({ nickname, mobile, password }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(txt || '注册失败');
    }

    const data = await resp.json();
    const token = data.token;
    if (!token) throw new Error('注册成功但未返回 token');

    localStorage.setItem(TOKEN_KEY, token);
    if (data.user) {
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    }

    registerStatus.textContent = '注册成功';
    showToast('注册成功');
    mobileInput.value = mobile;
    passwordInput.value = '';
    showLoginView();
    renderApp();
    connectMessageSocket(token);
  } catch (error) {
    registerStatus.textContent = error.message || '注册失败';
    showToast(error.message || '注册失败');
  }
}

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  login();
});

registerForm.addEventListener('submit', registerUser);

if (goRegisterLink) {
  goRegisterLink.addEventListener('click', (event) => {
    event.preventDefault();
    showRegisterView();
  });
}

if (goLoginLink) {
  goLoginLink.addEventListener('click', (event) => {
    event.preventDefault();
    showLoginView();
  });
}

if (refreshCaptchaBtn) {
  refreshCaptchaBtn.addEventListener('click', fetchCaptcha);
}

if (captchaImage) {
  captchaImage.addEventListener('click', fetchCaptcha);
}

if (dialogCloseBtn) {
  dialogCloseBtn.addEventListener('click', closeMessageDialog);
}

if (getSmsBtn) getSmsBtn.addEventListener('click', requestSmsCode);
if (smsLoginBtn) smsLoginBtn.addEventListener('click', mobileLoginWithCode);
if (getRegisterSmsBtn) getRegisterSmsBtn.addEventListener('click', requestRegisterSmsCode);
if (logoutBtn) logoutBtn.addEventListener('click', logout);
if (uploadBtn) uploadBtn.addEventListener('click', uploadFile);
if (sendMessageBtn) sendMessageBtn.addEventListener('click', sendTestMessage);
if (sendMessage2Btn) sendMessage2Btn.addEventListener('click', sendMessageViaStomp);
if (erpBtn) erpBtn.addEventListener('click', fetchErpCurrentPlant);
if (erpBtn2) erpBtn2.addEventListener('click', fetchErpPermissionData);

window.addEventListener('DOMContentLoaded', () => {
  renderApp();
  fetchCaptcha();

  const token = getToken();
  if (token) {
    connectMessageSocket(token);
  }
});
