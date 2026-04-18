# GongXi Mail API 文档

## 认证方式

所有 API 请求都需要携带有效的 API Key。支持以下三种认证方式：

| 方式 | 示例 | 说明 |
|------|------|------|
| **Header (推荐)** | `X-API-Key: sk_your_api_key` | 在请求头中传递 API Key |
| **Bearer Token** | `Authorization: Bearer sk_your_api_key` | 使用 Bearer Token 格式 |
| **Query 参数** | `?api_key=sk_your_api_key` | URL 参数传递（不推荐，会被日志记录） |

> **注意**：请在管理后台「API Key」页面创建密钥，密钥只在创建时显示一次，请妥善保存。

---

## 接口说明

系统提供灵活的邮箱访问方式：

- **直接访问**：如果您已知目标邮箱地址，可直接调用 `/api/mail_new` 或 `/api/mail_all` 获取邮件，无需任何前置分配操作。
- **标签筛选**：调用 `/api/get-email` 可根据标签筛选邮箱，支持排除特定标签的邮箱，默认返回 1 个邮箱。
- **文本提速**：对于自动化脚本，推荐使用 `/api/mail_text` 配合正则匹配，直接获取验证码等核心信息。

---

## 接口列表

### 1. 获取邮箱地址

**接口**: `POST /api/get-email`  
**方法**: GET/POST  
**描述**: 根据标签筛选获取邮箱地址。可通过 `excludeTags` 参数排除特定标签的邮箱，通过 `group` 参数限制仅从指定分组中获取。

#### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `excludeTags` | string[] | 否 | 要排除的标签（可传多个） |
| `group` | string | 否 | 分组名称，仅从该分组中获取 |
| `page` | number | 否 | 页码（默认 1） |
| `pageSize` | number | 否 | 每页数量（默认 1，最大 100） |

#### 调用示例

```bash
# 获取一个邮箱（不排除任何标签）
curl -X POST "http://localhost:3000/api/get-email" \
  -H "X-API-Key: sk_your_api_key"

# 排除带有 banned 和 spam 标签的邮箱
curl -X POST "http://localhost:3000/api/get-email" \
  -H "X-API-Key: sk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"excludeTags": ["banned", "spam"]}'
```

#### 成功响应

```json
{
  "success": true,
  "data": {
    "emails": [
      {
        "id": 1,
        "email": "example@outlook.com",
        "tags": ["verified"],
        "groupId": null,
        "group": null
      }
    ],
    "total": 85,
    "page": 1,
    "pageSize": 1,
    "excludedTags": ["banned", "spam"]
  }
}
```

#### 错误响应

```json
{
  "success": false,
  "error": {
    "code": "GROUP_NOT_FOUND",
    "message": "Email group 'premium' not found"
  }
}
```

---

### 2. 获取最新邮件

**接口**: `POST /api/mail_new`  
**方法**: GET/POST  
**描述**: 获取指定邮箱的最新一封邮件。只要邮箱地址存在于系统中即可获取。

#### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `email` | string | 是 | 邮箱地址 |
| `mailbox` | string | 否 | 邮件文件夹，默认 `inbox` |
| `socks5` | string | 否 | SOCKS5 代理地址 |
| `http` | string | 否 | HTTP 代理地址 |

#### 调用示例

```bash
curl -X POST "http://localhost:3000/api/mail_new" \
  -H "X-API-Key: sk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"email": "example@outlook.com"}'
```

#### 成功响应

```json
{
  "success": true,
  "data": {
    "email": "example@outlook.com",
    "mailbox": "inbox",
    "count": 1,
    "messages": [
      {
        "id": "AAMk...",
        "subject": "验证码邮件",
        "from": "noreply@example.com",
        "text": "您的验证码是 123456"
      }
    ],
    "method": "graph_api"
  },
  "email": "example@outlook.com"
}
```

#### 错误响应

```json
{
  "success": false,
  "error": {
    "code": "EMAIL_NOT_FOUND",
    "message": "Email account not found"
  }
}
```

---

### 3. 获取邮件文本 (脚本友好)

**接口**: `GET /api/mail_text`  
**方法**: GET/POST  
**描述**: 专门为脚本设计的轻量接口，返回 `text/plain` 格式的内容。支持正则表达式提取验证码。

#### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `email` | string | 是 | 邮箱地址 |
| `match` | string | 否 | 正则表达式 (例如 `\d{6}`) |

#### 调用示例

```bash
# 获取验证码
curl "http://localhost:3000/api/mail_text?email=example@outlook.com&match=\d{6}" \
  -H "X-API-Key: sk_your_api_key"
```

#### 成功响应

```
123456
```

#### 错误响应

```
Error: No match found
```

---

### 4. 获取所有邮件

**接口**: `GET /api/mail_all`  
**方法**: GET/POST  
**描述**: 获取指定邮箱的所有邮件。只要邮箱地址存在于系统中即可获取。

#### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `email` | string | 是 | 邮箱地址 |
| `mailbox` | string | 否 | 邮件文件夹，默认 `inbox` |
| `socks5` | string | 否 | SOCKS5 代理地址 |
| `http` | string | 否 | HTTP 代理地址 |

#### 调用示例

```bash
curl "http://localhost:3000/api/mail_all?email=example@outlook.com" \
  -H "X-API-Key: sk_your_api_key"
```

#### 成功响应

```json
{
  "success": true,
  "data": {
    "email": "example@outlook.com",
    "mailbox": "inbox",
    "count": 2,
    "messages": [
      { "id": "...", "subject": "邮件1" },
      { "id": "...", "subject": "邮件2" }
    ],
    "method": "imap"
  },
  "email": "example@outlook.com"
}
```

#### 错误响应

```json
{
  "success": false,
  "error": {
    "code": "EMAIL_NOT_FOUND",
    "message": "Email account not found"
  }
}
```

---

### 5. 清空邮箱

**接口**: `POST /api/process-mailbox`  
**方法**: GET/POST  
**描述**: 清空指定邮箱的所有邮件。

#### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `email` | string | 是 | 邮箱地址 |
| `mailbox` | string | 否 | 邮件文件夹，默认 `inbox` |
| `socks5` | string | 否 | SOCKS5 代理地址 |
| `http` | string | 否 | HTTP 代理地址 |

#### 调用示例

```bash
curl -X POST "http://localhost:3000/api/process-mailbox" \
  -H "X-API-Key: sk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"email": "example@outlook.com"}'
```

#### 成功响应

```json
{
  "success": true,
  "data": {
    "email": "example@outlook.com",
    "mailbox": "inbox",
    "status": "success",
    "deletedCount": 5,
    "message": "Successfully deleted 5 messages"
  },
  "email": "example@outlook.com"
}
```

#### 错误响应

```json
{
  "success": false,
  "error": {
    "code": "EMAIL_NOT_FOUND",
    "message": "Email account not found"
  }
}
```

---

### 6. 获取可用邮箱列表

**接口**: `GET /api/list-emails`  
**方法**: GET/POST  
**描述**: 获取系统中所有可用的邮箱地址列表。支持按分组筛选。

#### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `group` | string | 否 | 分组名称，仅返回该分组内的邮箱 |

#### 调用示例

```bash
curl "http://localhost:3000/api/list-emails" \
  -H "X-API-Key: sk_your_api_key"
```

#### 成功响应

```json
{
  "success": true,
  "data": {
    "total": 100,
    "emails": [
      { "email": "user1@outlook.com", "status": "ACTIVE", "group": null },
      { "email": "user2@outlook.com", "status": "ACTIVE", "group": "premium" }
    ]
  }
}
```

#### 错误响应

```json
{
  "success": false,
  "error": {
    "code": "AUTH_REQUIRED",
    "message": "API Key required"
  }
}
```

---

### 7. 给邮箱添加标签

**接口**: `POST /api/add-tags`  
**方法**: POST  
**描述**: 为指定邮箱添加一个或多个标签。支持批量添加，自动去重。

#### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `email` | string | 是 | 邮箱地址 |
| `tags` | string[] | 是 | 标签数组（至少 1 个） |

#### 调用示例

```bash
curl -X POST "http://localhost:3000/api/add-tags" \
  -H "X-API-Key: sk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"email": "user@outlook.com", "tags": ["verified", "premium"]}'
```

#### 成功响应

```json
{
  "success": true,
  "data": {
    "email": "user@outlook.com",
    "tags": ["verified", "premium", "openai"],
    "addedTags": ["verified", "premium"]
  }
}
```

#### 错误响应

```json
{
  "success": false,
  "error": {
    "code": "EMAIL_NOT_FOUND",
    "message": "Email account not found"
  }
}
```

---

### 8. 批量导入邮箱

**接口**: `POST /api/import-emails`  
**方法**: POST  
**描述**: 批量导入邮箱账户。支持多种格式，自动识别并创建或更新邮箱。

#### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `content` | string | 是 | 邮箱数据内容（多行文本） |
| `separator` | string | 否 | 分隔符，默认 `----` |
| `groupId` | number | 否 | 分组 ID（可选） |

#### 支持的格式

系统自动识别以下三种格式：

1. **3 列格式**: `email----clientId----refreshToken`
2. **4 列格式**: `email----password----clientId----refreshToken`
3. **5 列格式**: `email----clientId----uuid----info----refreshToken`

#### 调用示例

```bash
curl -X POST "http://localhost:3000/api/import-emails" \
  -H "X-API-Key: sk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "user1@outlook.com----client123----token123\nuser2@outlook.com----pass456----client456----token456",
    "separator": "----",
    "groupId": 1
  }'
```

#### 成功响应

```json
{
  "success": true,
  "data": {
    "success": 2,
    "failed": 0,
    "errors": []
  }
}
```

#### 部分失败响应

```json
{
  "success": true,
  "data": {
    "success": 1,
    "failed": 1,
    "errors": [
      "Line \"invalid-email----client----...\": Invalid format"
    ]
  }
}
```

#### 错误响应

```json
{
  "success": false,
  "error": {
    "code": "GROUP_FORBIDDEN",
    "message": "This API Key cannot access the selected group"
  }
}
```

---

## 操作日志 Action 值

用于 `/admin/dashboard/logs` 的 `action` 筛选：

| Action | 含义 |
|--------|------|
| `get_email` | 获取邮箱 |
| `mail_new` | 获取最新邮件 |
| `mail_text` | 获取邮件文本 |
| `mail_all` | 获取所有邮件 |
| `process_mailbox` | 清空邮箱 |
| `list_emails` | 获取邮箱列表 |
| `add_tags` | 添加标签 |
| `import_emails` | 批量导入邮箱 |

---

## API Key 权限键

API Key 的 `permissions` 使用与上表一致的 action 值（如 `mail_new`、`process_mailbox`、`import_emails`）。  
未配置 `permissions` 时默认允许全部接口。

---

## 枚举约定

为避免前后端不一致，所有枚举统一使用大写：

| 类型 | 枚举值 |
|------|--------|
| 管理员角色 | `SUPER_ADMIN` / `ADMIN` |
| 管理员/API Key 状态 | `ACTIVE` / `DISABLED` |
| 邮箱状态 | `ACTIVE` / `ERROR` / `DISABLED` |

---

## 健康检查

```bash
curl http://localhost:3000/health
# {"success":true,"data":{"status":"ok"}}
```

---

## 生产配置要求

- `JWT_SECRET`、`ENCRYPTION_KEY`、`ADMIN_PASSWORD` 必须通过外部环境变量注入。
- 如启用 2FA，`ADMIN_2FA_SECRET` 也必须通过外部环境变量注入。
- 不要在 `docker-compose.yml`、`.env`、代码仓库中写死生产密钥。
- 如需跨域访问，配置 `CORS_ORIGIN`（如 `https://admin.example.com,https://ops.example.com`）。
- 生产模式会在启动时对前端静态资源生成 `.gz/.br` 预压缩文件，并优先下发压缩版本。
- 服务会按 `API_LOG_RETENTION_DAYS` 与 `API_LOG_CLEANUP_INTERVAL_MINUTES` 自动清理历史 API 日志。
