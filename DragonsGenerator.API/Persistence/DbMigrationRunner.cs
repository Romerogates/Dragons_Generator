using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Persistence;

/// <summary>
/// Migrations versionnées — chaque migration s'exécute une seule fois (table __DbMigrations).
/// </summary>
public static class DbMigrationRunner
{
    public static async Task ApplyAllAsync(AppDbContext db, CancellationToken ct = default)
    {
        await EnsureHistoryTableAsync(db, ct);
        var applied = await GetAppliedIdsAsync(db, ct);

        foreach (var migration in Migrations)
        {
            if (applied.Contains(migration.Id)) continue;
            await migration.Apply(db, ct);
            await RecordAsync(db, migration.Id, ct);
        }
    }

    private static readonly Migration[] Migrations =
    [
        new("001_campaign_social_tables", Apply001CampaignSocialTablesAsync),
        new("002_support_user_columns", Apply002SupportUserColumnsAsync),
        new("003_profile_columns", Apply003ProfileColumnsAsync),
        new("004_friend_chat_tables", Apply004FriendChatTablesAsync),
        new("005_push_subscriptions", Apply005PushSubscriptionsAsync),
        new("006_campaign_activity", Apply006CampaignActivityAsync),
        new("007_message_attachments", Apply007MessageAttachmentsAsync),
        new("008_session_reminder_logs", Apply008SessionReminderLogsAsync),
        new("009_user_preferences_json", Apply009UserPreferencesJsonAsync),
    ];

    private sealed record Migration(string Id, Func<AppDbContext, CancellationToken, Task> Apply);

    private static async Task EnsureHistoryTableAsync(AppDbContext db, CancellationToken ct)
    {
        await db.Database.ExecuteSqlRawAsync(
            """
            CREATE TABLE IF NOT EXISTS "__DbMigrations" (
                "Id" TEXT NOT NULL CONSTRAINT "PK___DbMigrations" PRIMARY KEY,
                "AppliedAt" TEXT NOT NULL
            );
            """,
            ct);
    }

    private static async Task<HashSet<string>> GetAppliedIdsAsync(AppDbContext db, CancellationToken ct)
    {
        var list = new HashSet<string>(StringComparer.Ordinal);
        await using var conn = db.Database.GetDbConnection();
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """SELECT "Id" FROM "__DbMigrations";""";
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
            list.Add(reader.GetString(0));
        return list;
    }

    private static async Task RecordAsync(AppDbContext db, string id, CancellationToken ct)
    {
        var appliedAt = DateTimeOffset.UtcNow.ToString("O");
        await db.Database.ExecuteSqlInterpolatedAsync(
            $"""INSERT INTO "__DbMigrations" ("Id", "AppliedAt") VALUES ({id}, {appliedAt});""",
            ct);
    }

    private static async Task Apply001CampaignSocialTablesAsync(AppDbContext db, CancellationToken ct)
    {
        await db.Database.ExecuteSqlRawAsync(
            """
            CREATE TABLE IF NOT EXISTS "Friendships" (
                "Id" TEXT NOT NULL CONSTRAINT "PK_Friendships" PRIMARY KEY,
                "RequesterId" TEXT NOT NULL,
                "AddresseeId" TEXT NOT NULL,
                "Status" TEXT NOT NULL,
                "CreatedAt" TEXT NOT NULL,
                CONSTRAINT "FK_Friendships_Users_RequesterId" FOREIGN KEY ("RequesterId") REFERENCES "Users" ("Id") ON DELETE CASCADE,
                CONSTRAINT "FK_Friendships_Users_AddresseeId" FOREIGN KEY ("AddresseeId") REFERENCES "Users" ("Id") ON DELETE CASCADE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_Friendships_RequesterId_AddresseeId" ON "Friendships" ("RequesterId", "AddresseeId");

            CREATE TABLE IF NOT EXISTS "Campaigns" (
                "Id" TEXT NOT NULL CONSTRAINT "PK_Campaigns" PRIMARY KEY,
                "OwnerUserId" TEXT NOT NULL,
                "Title" TEXT NOT NULL,
                "JsonData" TEXT NOT NULL,
                "CreatedAt" TEXT NOT NULL,
                "UpdatedAt" TEXT NOT NULL,
                CONSTRAINT "FK_Campaigns_Users_OwnerUserId" FOREIGN KEY ("OwnerUserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS "CampaignMembers" (
                "Id" TEXT NOT NULL CONSTRAINT "PK_CampaignMembers" PRIMARY KEY,
                "CampaignId" TEXT NOT NULL,
                "UserId" TEXT NOT NULL,
                "Role" TEXT NOT NULL,
                "ApprovedCharacterId" TEXT NULL,
                "ApprovedCharacterName" TEXT NULL,
                "ApprovedCharacterLevel" INTEGER NULL,
                "ProposedCharacterId" TEXT NULL,
                "ProposedCharacterName" TEXT NULL,
                "ProposedCharacterLevel" INTEGER NULL,
                "ProposalStatus" TEXT NOT NULL,
                "XpEarnedInCampaign" INTEGER NOT NULL DEFAULT 0,
                "JoinedAt" TEXT NOT NULL,
                CONSTRAINT "FK_CampaignMembers_Campaigns_CampaignId" FOREIGN KEY ("CampaignId") REFERENCES "Campaigns" ("Id") ON DELETE CASCADE,
                CONSTRAINT "FK_CampaignMembers_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_CampaignMembers_CampaignId_UserId" ON "CampaignMembers" ("CampaignId", "UserId");

            CREATE TABLE IF NOT EXISTS "CampaignInvites" (
                "Id" TEXT NOT NULL CONSTRAINT "PK_CampaignInvites" PRIMARY KEY,
                "CampaignId" TEXT NOT NULL,
                "InvitedUserId" TEXT NOT NULL,
                "InvitedByUserId" TEXT NOT NULL,
                "Status" TEXT NOT NULL,
                "CreatedAt" TEXT NOT NULL,
                CONSTRAINT "FK_CampaignInvites_Campaigns_CampaignId" FOREIGN KEY ("CampaignId") REFERENCES "Campaigns" ("Id") ON DELETE CASCADE,
                CONSTRAINT "FK_CampaignInvites_Users_InvitedUserId" FOREIGN KEY ("InvitedUserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS "IX_CampaignInvites_CampaignId_InvitedUserId_Status" ON "CampaignInvites" ("CampaignId", "InvitedUserId", "Status");
            """,
            ct);
    }

    private static async Task Apply002SupportUserColumnsAsync(AppDbContext db, CancellationToken ct)
    {
        await TryAddColumnAsync(db, "SupportTickets", "CharacterId", "TEXT NULL", ct);
        await TryAddColumnAsync(db, "SupportTickets", "CharacterName", "TEXT NULL", ct);
        await TryAddColumnAsync(db, "Users", "AcceptedTermsAt", "TEXT NULL", ct);
    }

    private static async Task Apply003ProfileColumnsAsync(AppDbContext db, CancellationToken ct)
    {
        await TryAddColumnAsync(db, "Users", "Bio", "TEXT NULL", ct);
        await TryAddColumnAsync(db, "Users", "AvatarEmoji", "TEXT NULL", ct);
        await TryAddColumnAsync(db, "Users", "AccentColor", "TEXT NOT NULL DEFAULT 'violet'", ct);
        await db.Database.ExecuteSqlRawAsync(
            """
            UPDATE "Users" SET "AccentColor" = 'violet' WHERE "AccentColor" IS NULL OR "AccentColor" = '';
            """,
            ct);
    }

    private static async Task Apply004FriendChatTablesAsync(AppDbContext db, CancellationToken ct)
    {
        await db.Database.ExecuteSqlRawAsync(
            """
            CREATE TABLE IF NOT EXISTS "FriendMessages" (
                "Id" TEXT NOT NULL CONSTRAINT "PK_FriendMessages" PRIMARY KEY,
                "SenderId" TEXT NOT NULL,
                "RecipientId" TEXT NOT NULL,
                "Body" TEXT NOT NULL,
                "CreatedAt" TEXT NOT NULL,
                CONSTRAINT "FK_FriendMessages_Users_SenderId" FOREIGN KEY ("SenderId") REFERENCES "Users" ("Id") ON DELETE CASCADE,
                CONSTRAINT "FK_FriendMessages_Users_RecipientId" FOREIGN KEY ("RecipientId") REFERENCES "Users" ("Id") ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS "IX_FriendMessages_SenderId_RecipientId_CreatedAt" ON "FriendMessages" ("SenderId", "RecipientId", "CreatedAt");

            CREATE TABLE IF NOT EXISTS "FriendChatReads" (
                "UserId" TEXT NOT NULL,
                "FriendUserId" TEXT NOT NULL,
                "LastReadAt" TEXT NOT NULL,
                CONSTRAINT "PK_FriendChatReads" PRIMARY KEY ("UserId", "FriendUserId"),
                CONSTRAINT "FK_FriendChatReads_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE,
                CONSTRAINT "FK_FriendChatReads_Users_FriendUserId" FOREIGN KEY ("FriendUserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
            );
            """,
            ct);
    }

    private static async Task Apply005PushSubscriptionsAsync(AppDbContext db, CancellationToken ct)
    {
        await db.Database.ExecuteSqlRawAsync(
            """
            CREATE TABLE IF NOT EXISTS "PushSubscriptions" (
                "Id" TEXT NOT NULL CONSTRAINT "PK_PushSubscriptions" PRIMARY KEY,
                "UserId" TEXT NOT NULL,
                "Endpoint" TEXT NOT NULL,
                "P256dh" TEXT NOT NULL,
                "Auth" TEXT NOT NULL,
                "CreatedAt" TEXT NOT NULL,
                CONSTRAINT "FK_PushSubscriptions_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_PushSubscriptions_UserId_Endpoint" ON "PushSubscriptions" ("UserId", "Endpoint");
            """,
            ct);
    }

    private static async Task Apply006CampaignActivityAsync(AppDbContext db, CancellationToken ct)
    {
        await db.Database.ExecuteSqlRawAsync(
            """
            CREATE TABLE IF NOT EXISTS "CampaignActivities" (
                "Id" TEXT NOT NULL CONSTRAINT "PK_CampaignActivities" PRIMARY KEY,
                "CampaignId" TEXT NOT NULL,
                "ActorUserId" TEXT NOT NULL,
                "Kind" TEXT NOT NULL,
                "PayloadJson" TEXT NOT NULL,
                "CreatedAt" TEXT NOT NULL,
                CONSTRAINT "FK_CampaignActivities_Campaigns_CampaignId" FOREIGN KEY ("CampaignId") REFERENCES "Campaigns" ("Id") ON DELETE CASCADE,
                CONSTRAINT "FK_CampaignActivities_Users_ActorUserId" FOREIGN KEY ("ActorUserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS "IX_CampaignActivities_CampaignId_CreatedAt" ON "CampaignActivities" ("CampaignId", "CreatedAt");
            """,
            ct);
    }

    private static async Task Apply007MessageAttachmentsAsync(AppDbContext db, CancellationToken ct)
    {
        await TryAddColumnAsync(db, "FriendMessages", "AttachmentKind", "TEXT NULL", ct);
        await TryAddColumnAsync(db, "FriendMessages", "AttachmentPayload", "TEXT NULL", ct);
    }

    private static async Task Apply008SessionReminderLogsAsync(AppDbContext db, CancellationToken ct)
    {
        await db.Database.ExecuteSqlRawAsync(
            """
            CREATE TABLE IF NOT EXISTS "SessionReminderLogs" (
                "Id" TEXT NOT NULL CONSTRAINT "PK_SessionReminderLogs" PRIMARY KEY,
                "CampaignId" TEXT NOT NULL,
                "SessionId" TEXT NOT NULL,
                "UserId" TEXT NOT NULL,
                "ReminderKind" TEXT NOT NULL,
                "SentAt" TEXT NOT NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_SessionReminderLogs_Dedupe"
                ON "SessionReminderLogs" ("CampaignId", "SessionId", "UserId", "ReminderKind");
            """,
            ct);
    }

    private static async Task Apply009UserPreferencesJsonAsync(AppDbContext db, CancellationToken ct)
    {
        await TryAddColumnAsync(db, "Users", "PreferencesJson", "TEXT NULL", ct);
        await db.Database.ExecuteSqlRawAsync(
            """
            UPDATE "Users"
            SET "PreferencesJson" = '{{}}'
            WHERE "PreferencesJson" IS NULL OR TRIM("PreferencesJson") = '';
            """,
            ct);
    }

    private static async Task TryAddColumnAsync(
        AppDbContext db,
        string table,
        string column,
        string definition,
        CancellationToken ct)
    {
        // DDL identifiers cannot be parameterized. Values come only from our migration
        // call sites (never user input); validate so EF1002 is a false positive here.
        if (!IsSafeSqlIdentifier(table) || !IsSafeSqlIdentifier(column) || !IsSafeSqlTypeDefinition(definition))
            throw new InvalidOperationException($"Refusing unsafe migration DDL: {table}.{column} {definition}");

        try
        {
#pragma warning disable EF1002 // Identifiers validated above; not user-controlled
            await db.Database.ExecuteSqlRawAsync(
                $"""ALTER TABLE "{table}" ADD COLUMN "{column}" {definition};""",
                ct);
#pragma warning restore EF1002
        }
        catch (Exception ex)
        {
            var msg = $"{ex.Message} {ex.InnerException?.Message}";
            if (msg.Contains("duplicate column", StringComparison.OrdinalIgnoreCase)
                || msg.Contains("already exists", StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            throw;
        }
    }

    private static bool IsSafeSqlIdentifier(string value) =>
        value.Length is > 0 and <= 64
        && value.All(c => char.IsAsciiLetterOrDigit(c) || c == '_');

    private static bool IsSafeSqlTypeDefinition(string definition) =>
        definition is "TEXT NULL"
            or "TEXT NOT NULL DEFAULT 'violet'";
}
