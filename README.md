# GongXi Mail (廾匸邮箱)

使用 Microsoft OAuth2 进行邮箱收取的 API 服务。

## 技术栈

- **后端**: Fastify 5 + TypeScript + Prisma 6
- **数据库**: PostgreSQL
- **缓存**: Redis
- **前端**: React + Ant Design + Vite

## 项目结构

```
├── server/                 # 后端服务
│   ├── src/
│   │   ├── config/        # 环境配置
│   │   ├── lib/           # 核心库
│   │   ├── plugins/       # Fastify 插件
│   │   ├── modules/       # 业务模块
│   ├── prisma/            # 数据库 Schema
│   └── package.json
├── web/                    # 前端管理面板
├── docker-compose.yml
└── Dockerfile
```

## 快速开始

### Docker 部署

生产环境请先注入密钥（不要写死在仓库）：

```bash
export JWT_SECRET="replace-with-at-least-32-char-random-secret"
export ENCRYPTION_KEY="replace-with-32-character-secret-key"
export ADMIN_PASSWORD="replace-with-strong-password"
```

然后启动：

```bash
docker-compose up -d --build
```

访问 http://localhost:3000

### 健康检查

```bash
curl http://localhost:3000/health
# {"success":true,"data":{"status":"ok"}}
```

## 开发质量检查

```bash
# 前端
cd web
npm run lint
npm run build

# 后端
cd ../server
npm run lint
npm run lint:fix
npm run build
npm run test
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| NODE_ENV | 环境 | development |
| PORT | 端口 | 3000 |
| DATABASE_URL | PostgreSQL 连接 | - |
| REDIS_URL | Redis 连接 | - |
| CORS_ORIGIN | 允许跨域来源（逗号分隔） | 开发环境默认放开 |
| JWT_SECRET | JWT 密钥 (≥32字符) | - |
| JWT_EXPIRES_IN | Token 过期时间 | 2h |
| ENCRYPTION_KEY | 加密密钥 (32字符) | - |
| ADMIN_USERNAME | 默认管理员用户名 | admin |
| ADMIN_PASSWORD | 默认管理员密码（生产禁止使用默认值） | - |
| ADMIN_LOGIN_MAX_ATTEMPTS | 管理员连续失败最大次数 | 5 |
| ADMIN_LOGIN_LOCK_MINUTES | 登录失败锁定分钟数 | 15 |
| ADMIN_2FA_SECRET | 可选管理员 TOTP Base32 密钥 | - |
| ADMIN_2FA_WINDOW | TOTP 时间窗口（步长） | 1 |
| API_LOG_RETENTION_DAYS | API 日志保留天数 | 30 |
| API_LOG_CLEANUP_INTERVAL_MINUTES | API 日志清理间隔（分钟） | 60 |

## 枚举约定

为避免前后端不一致，所有枚举统一使用大写：

| 类型 | 枚举值 |
|------|--------|
| 管理员角色 | `SUPER_ADMIN` / `ADMIN` |
| 管理员/API Key 状态 | `ACTIVE` / `DISABLED` |

## 邮件拉取策略（分组级）

邮箱分组支持配置 `fetchStrategy`，同组邮箱统一使用该策略：

| 策略 | 行为 |
|------|------|
| `GRAPH_FIRST` | 先 Graph，失败后回退 IMAP |
| `IMAP_FIRST` | 先 IMAP，失败后回退 Graph |
| `GRAPH_ONLY` | 仅 Graph，不回退 |
| `IMAP_ONLY` | 仅 IMAP，不回退 |

说明：`IMAP_ONLY` 不支持”清空邮箱（process-mailbox）”，该操作依赖 Graph API。

## 邮箱标签系统

系统支持为邮箱添加自定义标签，用于分类和筛选：

### 管理后台功能
- **标签管理**：在邮箱编辑界面添加/删除标签
- **标签筛选**：支持反向筛选（排除指定标签的邮箱）
- **批量操作**：可通过 API 批量添加标签

### 使用场景
- 标记已验证的邮箱：`verified`
- 标记特定用途：`openai`, `discord`, `aws`
- 标记问题邮箱：`banned`, `spam`, `error`
- 自定义分类：支持任意标签名称

### 前端筛选示例
在管理后台邮箱列表页面，使用”排除标签”输入框可以过滤掉包含特定标签的邮箱，例如：
- 排除 `openai` 标签：只显示未用于 OpenAI 的邮箱
- 排除 `banned,spam`：过滤掉被标记为问题的邮箱

## API 文档

### 外部 API (`/api/*`)

需要在 HTTP Header 中携带 API Key：`X-API-Key: sk_xxx`

#### 接口列表

| 接口 | 说明 | 注意事项 |
|------|------|----------|
| `/api/get-email` | 获取一个未使用的邮箱地址 | 会标记为当前 Key 已使用 |
| `/api/mail_new` | 获取最新邮件 | - |
| `/api/mail_text` | 获取最新邮件文本 (脚本友好) | 可用正则提取内容 |
| `/api/mail_all` | 获取所有邮件 | - |
| `/api/process-mailbox` | 清空邮箱 | `data.deletedCount` 为删除数量 |
| `/api/list-emails` | 获取系统所有可用邮箱 | - |
| `/api/pool-stats` | 邮箱池统计 | - |
| `/api/reset-pool` | 重置分配记录 | 释放当前 Key 占用的所有邮箱标记 |
| `/api/filter-by-tags` | 根据标签反向筛选邮箱 | 返回不包含指定标签的邮箱 |
| `/api/add-tags` | 给邮箱添加标签 | 支持批量添加，自动去重 |

#### 使用流程

1. **获取邮箱**：
   ```bash
   curl -X POST "/api/get-email" -H "X-API-Key: sk_xxx"
   # {"success": true, "data": {"email": "xxx@outlook.com"}}
   ```

2. **获取邮件内容 (推荐)**：
   自动提取验证码（6位数字）：
   ```bash
   curl "/api/mail_text?email=xxx@outlook.com&match=\\d{6}" -H "X-API-Key: sk_xxx"
   # 返回: 123456
   ```

3. **获取完整邮件 (JSON)**：
   ```bash
   curl -X POST "/api/mail_new" -H "X-API-Key: sk_xxx" \
     -d '{"email": "xxx@outlook.com"}'
   ```

4. **标签管理**：
   添加标签：
   ```bash
   curl -X POST "/api/add-tags" -H "X-API-Key: sk_xxx" \
     -d '{"email": "xxx@outlook.com", "tags": ["verified", "premium"]}'
   ```
   
   筛选邮箱（排除特定标签）：
   ```bash
   curl "/api/filter-by-tags?excludeTags=banned&excludeTags=spam&page=1&pageSize=50" \
     -H "X-API-Key: sk_xxx"
   ```

#### 参数说明

**通用参数**：
| 参数 | 说明 |
|------|------|
| email | 邮箱地址（必填） |
| mailbox | 文件夹：inbox/junk |
| socks5 | SOCKS5 代理 |
| http | HTTP 代理 |

**`/api/mail_text` 专用参数**：
| 参数 | 说明 |
|------|------|
| match | 正则表达式，用于提取特定内容 (例如 `\d{6}`) |

**`/api/filter-by-tags` 参数**：
| 参数 | 说明 |
|------|------|
| excludeTags | 要排除的标签（字符串或数组） |
| group | 分组名称（可选） |
| page | 页码（默认 1） |
| pageSize | 每页数量（默认 50，最大 100） |

**`/api/add-tags` 参数**：
| 参数 | 说明 |
|------|------|
| email | 邮箱地址（必填） |
| tags | 标签数组（必填，至少 1 个） |

## 操作日志 Action 命名

`/admin/dashboard/logs` 中 `action` 字段使用以下固定值：

| Action | 含义 |
|--------|------|
| `get_email` | 分配邮箱 |
| `mail_new` | 获取最新邮件 |
| `mail_text` | 获取邮件文本 |
| `mail_all` | 获取所有邮件 |
| `process_mailbox` | 清空邮箱 |
| `list_emails` | 获取邮箱列表 |
| `pool_stats` | 邮箱池统计 |
| `pool_reset` | 重置邮箱池 |
| `filter_by_tags` | 标签筛选邮箱 |
| `add_tags` | 添加标签 |

## API Key 权限键

API Key 的 `permissions` 使用与上表一致的 action 值（如 `mail_new`、`process_mailbox`）。  
未配置 `permissions` 时默认允许全部接口。

## 生产配置要求

- `JWT_SECRET`、`ENCRYPTION_KEY`、`ADMIN_PASSWORD` 必须通过外部环境变量注入。
- 如启用 2FA，`ADMIN_2FA_SECRET` 也必须通过外部环境变量注入。
- 不要在 `docker-compose.yml`、`.env`、代码仓库中写死生产密钥。
- `server/.env.example` 仅作为模板，不能直接用于生产。
- 如需跨域访问，配置 `CORS_ORIGIN`（如 `https://admin.example.com,https://ops.example.com`）。
- 生产模式会在启动时对前端静态资源生成 `.gz/.br` 预压缩文件，并优先下发压缩版本。
- 服务会按 `API_LOG_RETENTION_DAYS` 与 `API_LOG_CLEANUP_INTERVAL_MINUTES` 自动清理历史 API 日志。

## License

MIT
