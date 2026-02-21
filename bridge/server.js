const express = require('express');
const Docker = require('dockerode');
const crypto = require('crypto');
const app = express();
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

app.use(express.json());

const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY;
if (!BRIDGE_API_KEY) {
    console.error("CRITICAL: BRIDGE_API_KEY environment variable is not set!");
    process.exit(1);
}

const DOCKER_NETWORK = process.env.DOCKER_NETWORK || "traefik-net";

// --- AGENT REGISTRY (Synchronized with main platform) ---
const agentZeroConfig = (opts) => ({
    image: "frankenstien.azurecr.io/agent-zero:latest",
    internalPort: 8000,
    env: {
        AGENT_PASSWORD: opts.password,
        SUBDOMAIN: opts.subdomain,
        DOMAIN: opts.domain
    },
    volumes: {
        [`ap-storage-${opts.storageKey}`]: "/app/storage"
    },
    memoryLimit: 2 * 1024 * 1024 * 1024,
    cpuLimit: 2000000000,
    pidLimit: 100
});

const openClawConfig = (opts) => ({
    image: "frankenstien.azurecr.io/openclaw:latest",
    internalPort: 5000,
    env: {
        PASSWORD: opts.password
    },
    volumes: {
        [`ap-storage-${opts.storageKey}`]: "/app/data"
    },
    memoryLimit: 1024 * 1024 * 1024,
    cpuLimit: 1000000000,
    pidLimit: 50
});

const agentRegistry = {
    "agent-zero": agentZeroConfig,
    "openclaw": openClawConfig,
    "research-assistant": agentZeroConfig,
    "code-assistant": agentZeroConfig,
    "productivity-agent": agentZeroConfig
};

// --- UTILS ---
function generatePassword() {
    return crypto.randomBytes(16).toString('hex');
}

function generateSubdomain(username, agentSlug) {
    const sanitized = username.toLowerCase().replace(/[^a-z0-9]/g, '');
    const suffix = crypto.randomBytes(2).toString('hex');
    return `${sanitized}-${agentSlug}-${suffix}`;
}

const auth = (req, res, next) => {
    if (req.headers['x-bridge-api-key'] !== BRIDGE_API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

// --- ROUTES ---

app.post('/provision', auth, async (req, res) => {
    const { userId, agentSlug, username } = req.body;
    const configFactory = agentRegistry[agentSlug];

    if (!configFactory) {
        return res.status(400).json({ error: 'Invalid agent slug' });
    }

    const domain = process.env.PUBLIC_DOMAIN || "randi.chat";
    const password = generatePassword();
    const subdomain = generateSubdomain(username, agentSlug);
    const storageKey = crypto.createHash('sha256').update(`${userId}:${agentSlug}`).digest('hex').slice(0, 16);

    const config = configFactory({ subdomain, password, domain, storageKey });
    const fullSubdomain = `${subdomain}.${domain}`;
    const containerName = `ap-${subdomain}`;

    try {
        // 1. Pull Image
        console.log(`Pulling image ${config.image}...`);
        const stream = await docker.pull(config.image);
        await new Promise((resolve, reject) => {
            docker.modem.followProgress(stream, (err, res) => err ? reject(err) : resolve(res));
        });

        // 2. Create Container
        console.log(`Creating container ${containerName}...`);
        const container = await docker.createContainer({
            Image: config.image,
            name: containerName,
            Env: Object.entries(config.env).map(([k, v]) => `${k}=${v}`),
            ExposedPorts: { [`${config.internalPort}/tcp`]: {} },
            HostConfig: {
                Binds: Object.entries(config.volumes).map(([v, p]) => `${v}:${p}`),
                Memory: config.memoryLimit,
                NanoCpus: config.cpuLimit,
                PidsLimit: config.pidLimit,
                NetworkMode: DOCKER_NETWORK
            },
            Labels: {
                "traefik.enable": "true",
                [`traefik.http.routers.${containerName}.rule`]: `Host(\`${fullSubdomain}\`)`,
                [`traefik.http.routers.${containerName}.entrypoints`]: "websecure",
                [`traefik.http.routers.${containerName}.tls.certresolver`]: "letlsenv",
                [`traefik.http.services.${containerName}.loadbalancer.server.port`]: String(config.internalPort),
                "agent-platform.managed": "true",
                "agent-platform.user-id": userId
            }
        });

        // 3. Start Container
        await container.start();

        res.json({
            dockerId: container.id,
            subdomain,
            url: `https://${fullSubdomain}`,
            password: agentSlug === "openclaw" ? password : null
        });
    } catch (err) {
        console.error("Provisioning failed:", err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/containers/:id/start', auth, async (req, res) => {
    try {
        await docker.getContainer(req.params.id).start();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/containers/:id/stop', auth, async (req, res) => {
    try {
        await docker.getContainer(req.params.id).stop({ t: 10 });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/containers/:id', auth, async (req, res) => {
    try {
        await docker.getContainer(req.params.id).remove({ force: true });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/containers/:id/inspect', auth, async (req, res) => {
    try {
        const data = await docker.getContainer(req.params.id).inspect();
        res.json(data);
    } catch (err) { res.status(err.statusCode || 500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Compute Bridge listening on port ${PORT}`));
