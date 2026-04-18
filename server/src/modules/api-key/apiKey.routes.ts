import { type FastifyPluginAsync } from 'fastify';
import { apiKeyService } from './apiKey.service.js';
import { createApiKeySchema, updateApiKeySchema, listApiKeySchema } from './apiKey.schema.js';

const apiKeyRoutes: FastifyPluginAsync = async (fastify) => {
    // 所有路由需要 JWT 认证
    fastify.addHook('preHandler', fastify.authenticateJwt);

    // 列表
    fastify.get('/', async (request) => {
        const input = listApiKeySchema.parse(request.query);
        const result = await apiKeyService.list(input);
        return { success: true, data: result };
    });

    // 创建
    fastify.post('/', async (request) => {
        const input = createApiKeySchema.parse(request.body);
        const apiKey = await apiKeyService.create(input, request.user!.id);
        request.log.info({
            systemEvent: true,
            action: 'api_key.create',
            actorId: request.user?.id ?? null,
            actorUsername: request.user?.username ?? null,
            apiKeyId: apiKey.id,
            name: apiKey.name,
        }, '新增 API Key');
        return { success: true, data: apiKey };
    });

    // 详情
    fastify.get('/:id', async (request) => {
        const { id } = request.params as { id: string };
        const apiKey = await apiKeyService.getById(parseInt(id));
        return { success: true, data: apiKey };
    });

    // 更新
    fastify.put('/:id', async (request) => {
        const { id } = request.params as { id: string };
        const input = updateApiKeySchema.parse(request.body);
        const apiKey = await apiKeyService.update(parseInt(id), input);
        request.log.info({
            systemEvent: true,
            action: 'api_key.update',
            actorId: request.user?.id ?? null,
            actorUsername: request.user?.username ?? null,
            apiKeyId: apiKey.id,
            name: apiKey.name,
            status: apiKey.status,
        }, '修改 API Key');
        return { success: true, data: apiKey };
    });

    // 删除
    fastify.delete('/:id', async (request) => {
        const { id } = request.params as { id: string };
        await apiKeyService.delete(parseInt(id));
        request.log.info({
            systemEvent: true,
            action: 'api_key.delete',
            actorId: request.user?.id ?? null,
            actorUsername: request.user?.username ?? null,
            apiKeyId: parseInt(id),
        }, '删除 API Key');
        return { success: true, data: { message: 'API Key deleted' } };
    });
};

export default apiKeyRoutes;


