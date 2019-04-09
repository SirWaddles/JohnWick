const { ShardingManager } = require('discord.js');
const { DiscordToken } = require('./tokens');
const manager = new ShardingManager('./discord.js', { token: DiscordToken });

manager.spawn();
manager.on('launch', shard => console.log(`Launched shard ${shard.id}`));
