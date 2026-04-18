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

详细的 API 文档请查看：[API.md](./API.md)

### 快速开始

外部 API 需要在 HTTP Header 中携带 API Key：`X-API-Key: sk_xxx`

常用接口：
- `/api/get-email` - 获取一个未使用的邮箱地址
- `/api/mail_new` - 获取最新邮件
- `/api/mail_text` - 获取邮件文本（脚本友好，支持正则提取）
- `/api/import-emails` - 批量导入邮箱
- `/api/add-tags` - 给邮箱添加标签
- `/api/filter-by-tags` - 根据标签筛选邮箱

更多接口和详细说明请参考 [API.md](./API.md)。

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
