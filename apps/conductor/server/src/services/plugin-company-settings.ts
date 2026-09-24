import { and, asc, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { pluginCompanySettings } from "@paperclipai/db";

/**
 * Row shape of `plugin_company_settings`.
 *
 * @see packages/db/src/schema/plugin_company_settings.ts
 */
export type PluginCompanySettingsRow = typeof pluginCompanySettings.$inferSelect;

/** Optional flags a caller may set alongside the settings payload on upsert. */
export interface UpsertPluginCompanySettingsOptions {
  /** Explicit enable/disable for this (company, plugin) pair. Omit to leave unchanged. */
  enabled?: boolean;
  /** Last error recorded against this pair (pass `null` to clear). Omit to leave unchanged. */
  lastError?: string | null;
}

/**
 * PluginCompanySettings – CRUD operations for the `plugin_company_settings`
 * table, which stores operator-managed plugin settings scoped to a single
 * company.
 *
 * This is the per-company sibling of `plugin_config` (instance-wide plugin
 * configuration, owned by {@link pluginRegistryService}). Each company has at
 * most one row per plugin, enforced by the
 * `plugin_company_settings_company_plugin_uq` unique index on
 * (`company_id`, `plugin_id`).
 *
 * The `settingsJson` payload is intentionally opaque here: the shape is owned
 * by whichever plugin the row belongs to, and is validated by the caller.
 *
 * Follows the same dependency-injected factory pattern used by the rest of the
 * Paperclip service layer.
 */
export function pluginCompanySettingsService(db: Db) {
  return {
    // ----- Read -----------------------------------------------------------

    /**
     * Get the settings row for a single (company, plugin) pair.
     *
     * @returns The row, or `null` when the company has no settings for the plugin.
     */
    get: (companyId: string, pluginId: string): Promise<PluginCompanySettingsRow | null> =>
      db
        .select()
        .from(pluginCompanySettings)
        .where(
          and(
            eq(pluginCompanySettings.companyId, companyId),
            eq(pluginCompanySettings.pluginId, pluginId),
          ),
        )
        .then((rows: PluginCompanySettingsRow[]) => rows[0] ?? null),

    /** List every plugin settings row belonging to a company, oldest first. */
    list: (companyId: string): Promise<PluginCompanySettingsRow[]> =>
      db
        .select()
        .from(pluginCompanySettings)
        .where(eq(pluginCompanySettings.companyId, companyId))
        .orderBy(asc(pluginCompanySettings.createdAt)),

    // ----- Write ----------------------------------------------------------

    /**
     * Create or update the settings row for a (company, plugin) pair.
     *
     * Conflicts on the (`company_id`, `plugin_id`) unique index are resolved by
     * updating `settings_json` and `updated_at`. `enabled` and `last_error` are
     * only written when the corresponding option is supplied, so an update that
     * omits them preserves whatever is already stored.
     *
     * @returns The inserted or updated row.
     */
    upsert: async (
      companyId: string,
      pluginId: string,
      settingsJson: Record<string, unknown>,
      opts?: UpsertPluginCompanySettingsOptions,
    ): Promise<PluginCompanySettingsRow> => {
      const now = new Date();

      const insertValues: typeof pluginCompanySettings.$inferInsert = {
        companyId,
        pluginId,
        settingsJson,
        createdAt: now,
        updatedAt: now,
      };
      // Only set on update when explicitly supplied — otherwise keep the stored value.
      const updateSet: Partial<typeof pluginCompanySettings.$inferInsert> & { updatedAt: Date } = {
        settingsJson,
        updatedAt: now,
      };

      if (opts?.enabled !== undefined) {
        insertValues.enabled = opts.enabled;
        updateSet.enabled = opts.enabled;
      }
      if (opts?.lastError !== undefined) {
        insertValues.lastError = opts.lastError;
        updateSet.lastError = opts.lastError;
      }

      return db
        .insert(pluginCompanySettings)
        .values(insertValues)
        .onConflictDoUpdate({
          target: [pluginCompanySettings.companyId, pluginCompanySettings.pluginId],
          set: updateSet,
        })
        .returning()
        .then((rows: PluginCompanySettingsRow[]) => rows[0]!);
    },
  };
}
