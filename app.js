const BASE_URL = 'http://localhost:8769';
const TOKEN_KEY = 'sharp_platform_token';
const USER_KEY = 'sharp_platform_user';
const UPLOADED_FILES_KEY = 'uploaded_files';
const DEVICE_ID_KEY = 'sharp_platform_device_id';

const loginView = document.getElementById('loginView');
const homeView = document.getElementById('homeView');
const loginForm = document.getElementById('loginForm');
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

// captcha elements
const captchaInput = document.getElementById('captchaInput');
const captchaImage = document.getElementById('captchaImage');
const refreshCaptchaBtn = document.getElementById('refreshCaptchaBtn');
let _lastCaptchaUrl = null;

// sms elements
const smsCodeInput = document.getElementById('smsCodeInput');
const getSmsBtn = document.getElementById('getSmsBtn');
const smsLoginBtn = document.getElementById('smsLoginBtn');
const smsStatus = document.getElementById('smsStatus');

let stompClient = null;

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

function renderApp() {
  const token = getToken();
  const isLoggedIn = Boolean(token);
  loginView.classList.toggle('hidden', isLoggedIn);
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

  renderApp();
  showToast('已退出登录');
}

async function login() {
  const mobile = mobileInput.value.trim();
  const password = passwordInput.value.trim();

  if (!mobile || !password) {
    showToast('请输入手机号和密码');
    return;
  }

  try {
    const deviceId = getDeviceId();
    const payload = { mobile, password, deviceId };
    if (captchaInput && captchaInput.value) {
      payload.captcha = captchaInput.value.trim();
    }

    const response = await fetch(`${BASE_URL}/auth/login?code=${payload.captcha}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'deviceId': deviceId,
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
  } catch (error) {
    console.error('Login failed', error);
    showToast(error.message || '登录失败');
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
      try { URL.revokeObjectURL(_lastCaptchaUrl); } catch (e) { /* ignore */ }
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
  const socket = new SockJS(messageUrl + '/ws/message?access_token=' + encodeURIComponent(token));
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

// SMS code: request and mobile-login
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
    if (token) headers['Authorization'] = `Bearer ${token}`;

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
  } catch (error) {
    console.error('requestSmsCode failed', error);
    smsStatus.textContent = error.message || '获取验证码失败';
    showToast(error.message || '获取验证码失败');
  } finally {
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

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  login();
});

// captcha interactions
// if (refreshCaptchaBtn) refreshCaptchaBtn.addEventListener('click', fetchCaptcha);
if (captchaImage) captchaImage.addEventListener('click', fetchCaptcha);
// if (mobileInput) mobileInput.addEventListener('blur', fetchCaptcha);

// initial captcha load
window.addEventListener('load', () => {
  // load captcha for current mobile value
  fetchCaptcha();
});

logoutBtn.addEventListener('click', logout);
uploadBtn.addEventListener('click', uploadFile);
sendMessageBtn.addEventListener('click', sendTestMessage);
sendMessage2Btn.addEventListener('click', sendMessageViaStomp);

if (getSmsBtn) getSmsBtn.addEventListener('click', requestSmsCode);
if (smsLoginBtn) smsLoginBtn.addEventListener('click', mobileLoginWithCode);

window.addEventListener('DOMContentLoaded', () => {
  renderApp();

  const token = getToken();
  if (token) {
    connectMessageSocket(token);
  }
});
