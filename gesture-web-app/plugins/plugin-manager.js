export class PluginManager {
    constructor() {
        this.plugins = new Map();
    }

    register(name, plugin, canvas) {
        if (this.plugins.has(name)) {
            console.warn(`Plugin "${name}" already registered, replacing`);
        }
        this.plugins.set(name, plugin);
        if (plugin.init) {
            plugin.init(canvas);
        }
        console.log(`Plugin "${name}" registered`);
    }

    unregister(name) {
        const plugin = this.plugins.get(name);
        if (plugin && plugin.destroy) {
            plugin.destroy();
        }
        this.plugins.delete(name);
        console.log(`Plugin "${name}" unregistered`);
    }

    updateAll(landmarksList, canvas) {
        this.plugins.forEach((plugin, name) => {
            try {
                if (plugin.update) {
                    plugin.update(landmarksList, canvas);
                }
            } catch (error) {
                console.error(`Error updating plugin "${name}":`, error);
            }
        });
    }

    drawAll(ctx) {
        this.plugins.forEach((plugin, name) => {
            try {
                if (plugin.draw) {
                    plugin.draw(ctx);
                }
            } catch (error) {
                console.error(`Error drawing plugin "${name}":`, error);
            }
        });
    }

    get(name) {
        return this.plugins.get(name);
    }

    getAll() {
        return Array.from(this.plugins.keys());
    }

    clear() {
        this.plugins.forEach((plugin) => {
            if (plugin.destroy) {
                plugin.destroy();
            } else if (plugin.clear) {
                plugin.clear();
            }
        });
        this.plugins.clear();
    }
}

export const pluginManager = new PluginManager();
