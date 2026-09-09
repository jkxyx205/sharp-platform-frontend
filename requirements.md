# 接口文档

BASE_URL = http://localhost:8769

## 注册

### 发送注册短信验证码 code 
curl --location 'http://localhost:8769/sms/{mobile}/register' \
--header 'deviceId: <mobile>'

### 注册

curl --location 'http://localhost:8769/auth/register?mobile={mobile}&code={code}' \
--header 'deviceId: <mobile>' \
--header 'Content-Type: application/json' \
--data '{"nickname":"Rick","mobile":"{mobile}","password":"111111"}'

```
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


## 登录

### 手机/密码登录

curl --location 'http://localhost:8769/auth/login?code={code}' \
--header 'Content-Type: application/json' \
--data '{
    "mobile": "17787878767",
    "password": "111111"
}'

```
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

### 手机验证码登录

获取手机验证码：
    curl --location 'http://localhost:8769/sms/{mobile}/mobile_login' \
--header 'deviceId: {mobile}' \
--header 'Authorization: Bearer <token>'

发送登录请求：
curl --location 'http://localhost:8769/auth/mobile_login?mobile={mobile}&code={code}' \
--header 'Content-Type: application/json' \
--header 'deviceId: <mobile>' \
--data '{
    "mobile": "<mobile>",
    "code": <code>
}'

```
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

## 退出登录

 curl -X POST http://localhost:8769/auth/logout -H "Authorization: Bearer <token>"
 退出登录后，消息推送端点也需要断开

## 消息推送端点

STOMP/SockJS 消息推送端点。前端（messageUrl = 网关地址 + /api/platform）：

``` 
new SockJS(messageUrl + "/ws/message?access_token=" + token)
stompClient.subscribe("/user/queue/message", ...)
```

# 文件上传

curl --location 'http://localhost:8769/api/site/100/documents/upload' \
--header 'Authorization: Bearer e89faea9e23e4bcab0e6aa7ed0769162' \
--form 'file=@"/Users/rick/Downloads/a-1.a09006c3.jpg"' \
--form 'groupName="662/images"'

```
{
    "success": true,
    "code": 200,
    "message": "OK",
    "data": [
        {
            "name": "a-1.a09006c3",
            "extension": "jpg",
            "contentType": "image/jpeg",
            "size": "474439",
            "groupName": "662/images",
            "path": "1128634581776338944.jpg",
            "url": "http://127.0.0.1:7892/662/images/1128634581776338944.jpg",
            "id": "1128634581923139584",
            "fullName": "a-1.a09006c3.jpg",
            "fullPath": "662/images/1128634581776338944.jpg"
        }
    ]
}

```

# 文件下载

curl --location 'http://localhost:8769/api/site/999/documents/download/1128638914295238656' \
--header 'Authorization: Bearer e89faea9e23e4bcab0e6aa7ed0769162'

# 需求
1. 完成登录功能，进入 index 首页。保存toekn，访问接口都需要 --header 'Authorization: Bearer access_token'
2. 登录完成后，连接消息推送端点。后端推送消息，右下角弹出对话框提醒。5秒中后自动消失。
3. 首页功能：上传文件，groupName 默认是「upload」，可改。上传文件后，将链接地址（url）显示在首页，可以点击下载。
4. 首页添加一个按钮【发送消息】，通过 GET 请求 /api/platform/users/messages