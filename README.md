# Sharp Platform 前端需求说明

## 1. 项目概述

本项目是一个基于静态前端页面的平台 Demo，完成了以下核心能力：
- 用户登录与注册
- 图片验证码登录
- 手机验证码登录
- 退出登录
- 文件上传与下载
- 消息推送（SockJS + STOMP）
- ERP 当前数据读取展示
- 统一提示与错误弹窗

前端默认访问后端地址：
- `http://localhost:8769`

## 2. 页面结构与功能

### 2.1 登录页

登录页包含：
- 手机号输入
- 密码输入
- 图片验证码输入与刷新
- 用户名密码登录
- 短信验证码登录
- 注册入口

实际 UI 包含：
- `#mobile`
- `#password`
- `#captchaInput`
- `#captchaImage`
- `#refreshCaptchaBtn`
- `#smsCodeInput`
- `#getSmsBtn`
- `#smsLoginBtn`
- `#goRegisterLink`

登录成功后：
- 保存 `token` 到 `localStorage`
- 保存 `user` 到 `localStorage`
- 自动切换到首页
- 建立消息推送连接

### 2.2 注册页

注册页包含：
- 昵称输入
- 手机号输入
- 密码输入
- 注册短信验证码获取
- 注册验证码输入
- 注册提交
- 返回登录入口

注册成功后：
- 自动返回登录页
- 自动填充登录手机号

### 2.3 首页

首页包含：
- 欢迎信息
- 退出登录按钮
- 文件上传区域
- 消息测试区域
- ERP 数据展示区域
- 已上传文件列表

首页功能：
- 上传文件到指定分组
- 调用服务端消息接口
- 通过 STOMP 发送消息
- GET /api/erp/999/plants/current 并展示响应

## 3. 已实现的核心功能

### 3.1 图片验证码登录

前端在登录页会在页面加载时请求验证码：
- GET `/image/login`
- 请求头必须带 `deviceId`
- 后端返回图片内容，前端显示在 `img` 标签中
- 支持点击图片或点击“刷新”按钮更新验证码

### 3.2 用户名密码登录

请求：
- POST `/auth/login?code={captchaCode}`
- Header:
  - `Content-Type: application/json`
  - `deviceId: <随机设备号>`
- Body:
```json
{
  "mobile": "17787878767",
  "password": "111111",
  "deviceId": "随机设备号",
  "captcha": "图片验证码"
}
```

前端实现中会使用：
```javascript
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
```

### 3.3 退出登录

请求：
- POST `/auth/logout`
- Header:
  - `Authorization: Bearer <token>`

前端实现：
```javascript
await fetch(`${BASE_URL}/auth/logout`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
  },
});
```

退出后会：
- 清理 `token`
- 清理 `user`
- 清理 `uploaded_files`
- 断开 STOMP 连接
- 跳回登录页

### 3.4 手机验证码登录

#### 3.4.1 获取短信验证码

请求：
- GET `/sms/{mobile}/login`
- Header:
  - `deviceId: <随机设备号>`
  - `Authorization: Bearer <token>`（可选）

示例：
```bash
curl --location 'http://localhost:8769/sms/17787878767/login' \
  --header 'deviceId: {deviceId}' \
  --header 'Authorization: Bearer <token>'
```

前端中实际调用：
```javascript
const headers = { deviceId };
if (token) {
  headers.Authorization = `Bearer ${token}`;
}

await fetch(`${BASE_URL}/sms/${encodeURIComponent(mobile)}/login`, {
  method: 'GET',
  headers,
});
```

#### 3.4.2 提交短信验证码登录

请求：
- POST `/auth/mobile_login?mobile={mobile}&code={code}`
- Header:
  - `Content-Type: application/json`
  - `deviceId: <随机设备号>`
- Body:
```json
{
  "mobile": "17787878767",
  "password": "123456"
}
```

关键点：
- 当前实现确实需要提交 `mobile` 参数。
- `mobile` 同时出现在 URL query 参数中，并且以 `password: code` 的形式放在 JSON body 中。
- 这里的 `password` 实际上是短信验证码值。

示例：
```bash
curl --location 'http://localhost:8769/auth/mobile_login?mobile=17787878767&code=${code}' \
  --header 'Content-Type: application/json' \
  --header 'deviceId: {deviceId}' \
  --data '{
    "mobile": "17787878767",
    "password": "123456"
  }'
```

前端中实际调用：
```javascript
const resp = await fetch(`${BASE_URL}/auth/mobile_login?mobile=${mobile}&code=${encodeURIComponent(code)}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    deviceId,
  },
  body: JSON.stringify({ mobile, password: code }),
});
```

返回示例：
```json
{
  "token": "e89faea9e23e4bcab0e6aa7ed0769162",
  "user": {
    "id": 1127646863076364288,
    "nickname": "sm",
    "mobile": "17787878767",
    "avatar": null
  }
}
```

### 3.5 注册功能

#### 3.5.1 获取注册短信验证码

请求：
- GET `/sms/{mobile}/register`
- Header:
  - `deviceId: <随机设备号>`

示例：
```bash
curl --location 'http://localhost:8769/sms/17787878767/register' \
  --header 'deviceId: {deviceId}'
```

#### 3.5.2 注册提交

请求：
- POST `/auth/register?mobile={mobile}&code={code}`
- Header:
  - `Content-Type: application/json`
  - `deviceId: <随机设备号>`
- Body:
```json
{
  "nickname": "Rick",
  "mobile": "17787878767",
  "password": "111111"
}
```

示例：
```bash
curl --location 'http://localhost:8769/auth/register?mobile=17787878767&code=123456' \
  --header 'deviceId: {deviceId}' \
  --header 'Content-Type: application/json' \
  --data '{
    "nickname":"Rick",
    "mobile":"17787878767",
    "password":"111111"
  }'
```

前端实现：
```javascript
const resp = await fetch(`${BASE_URL}/auth/register?mobile=${encodeURIComponent(mobile)}&code=${encodeURIComponent(code)}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    deviceId: getDeviceId(),
  },
  body: JSON.stringify({ nickname, mobile, password }),
});
```

注册成功后：
- 自动切回登录页
- 确认成功消息
- 自动填充登录手机号

### 3.6 获取服务端消息

请求：
- GET `/api/platform/users/messages`
- Header:
  - `Authorization: Bearer <token>`

示例：
```bash
curl -X GET http://localhost:8769/api/platform/users/messages \
  -H "Authorization: Bearer <token>"
```

前端调用：
```javascript
fetch(`${BASE_URL}/api/platform/users/messages`, {
  method: 'GET',
  headers: {
    Authorization: `Bearer ${token}`,
  },
});
```

### 3.7 WebSocket 消息推送

#### 3.7.1 建立连接

前端使用 SockJS + STOMP：
```javascript
const socket = new SockJS(`${BASE_URL}/api/platform/ws/message?access_token=${encodeURIComponent(token)}`);
stompClient = Stomp.over(socket);
```

#### 3.7.2 订阅消息

订阅地址：
- `/user/queue/message`

#### 3.7.3 发送消息

发送地址：
- `/app/echo`

实际代码：
```javascript
stompClient.send('/app/echo', {}, payload);
```

其中 `payload` 来自页面 `textarea` 内容，不写死，取自用户输入：
```html
<textarea id="stompMessageInput" rows="3" placeholder="输入要发送的消息内容">内容</textarea>
```

### 3.8 文件上传

请求：
- POST `/api/site/{siteId}/documents/upload`
- Header:
  - `Authorization: Bearer <token>`
- FormData:
  - `file`
  - `groupName`

示例：
```javascript
const formData = new FormData();
formData.append('file', file);
formData.append('groupName', groupName);

await fetch(`${BASE_URL}/api/site/${siteId}/documents/upload`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
  },
  body: formData,
});
```

前端默认分组：
- `groupName = upload`

### 3.9 ERP 数据读取

请求：
- GET `/api/erp/999/plants/current`
- Header:
  - `Authorization: Bearer <token>`

示例：
```bash
curl -X GET http://localhost:8769/api/erp/999/plants/current \
  -H "Authorization: Bearer <token>"
```

前端实际调用：
```javascript
const resp = await fetch(`${BASE_URL}/api/erp/999/plants/current`, {
  method: 'GET',
  headers: {
    Authorization: `Bearer ${token}`,
  },
});
```

返回结果会展示到页面 `pre` 区域中。

## 4. 设备号规则

当前实现要求：
- `deviceId` 不能直接使用手机号
- 前端会在本地缓存中生成并复用随机设备号

实现：
```javascript
function getDeviceId() {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = `${Date.now()}${Math.random().toString(10).slice(2, 10)}`;
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}
```

对应存储键：
- `sharp_platform_device_id`

## 5. 本地状态存储

前端会使用 `localStorage` 保存以下内容：
- `sharp_platform_token`：token
- `sharp_platform_user`：当前用户对象
- `sharp_platform_device_id`：随机设备号
- `uploaded_files`：已上传文件列表

## 6. 交互细节

### 6.1 图片验证码刷新

- 页面加载执行 `fetchCaptcha()`
- 点击图片或刷新按钮都可以更新图片验证码
- 失败时弹出提示，并清空验证码图片

### 6.2 短信验证码倒计时

- 获取验证码按钮在发送成功后进入倒计时
- 倒计时过程中按钮禁用，避免重复发送
- 60 秒结束后恢复按钮状态

### 6.3 统一错误提示

前端统一使用：
- `toast`：临时成功/提示消息
- `dialog modal`：错误校验、重要提示

### 6.4 页面切换

- 登录页点击“注册”跳转到注册页
- 注册页点击“返回登录”回到登录页
- 注册成功后自动回到登录页并填充手机号

## 7. 代码文件说明

- [index.html](/Users/rick/Space/Workspace/sharp-platform-frontend/index.html)：页面结构与表单
- [styles.css](/Users/rick/Space/Workspace/sharp-platform-frontend/styles.css)：布局、按钮、弹窗、toast、倒计时样式
- [app.js](/Users/rick/Space/Workspace/sharp-platform-frontend/app.js)：所有 API 调用、状态管理、消息推送、页面交互逻辑

## 8. 需求生成建议

后续如要根据这个 README 直接生成前端需求，可优先提炼以下模块：
1. 登录模块：账号密码 + 图片验证码 + 手机验证码
2. 注册模块：短信验证码 + 注册提交
3. 首页模块：退出登录、上传文件、消息推送、ERP 展示
4. 认证规范：`deviceId` 与 `Authorization: Bearer <token>`
5. 交互要求：倒计时、刷新验证码、统一弹窗提示

## 9. 结论

当前前端已实现一整套完整的认证、消息、文件与 ERP 功能，覆盖了：
- 登录与注册
- 图片验证码与短信验证码
- 退出登录
- WebSocket 消息推送
- 文件上传
- ERP 数据展示
- 统一交互反馈

这份 README 可作为后续生成前端需求、功能验收和开发回顾的依据。
