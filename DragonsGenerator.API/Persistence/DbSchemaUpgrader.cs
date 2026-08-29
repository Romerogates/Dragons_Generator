using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Persistence;

/// <summary>
/// EnsureCreated ne met pas à jour une base existante — on crée les nouvelles tables à la main si besoin.
/// </summary>
public static class DbSchemaUpgrader
{
    public static async Task EnsureCampaignAndSocialTablesAsync(AppDbContext db, CancellationToken ct = default)
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

        await TryAddColumnAsync(db, "SupportTickets", "CharacterId", "TEXT NULL", ct);
        await TryAddColumnAsync(db, "SupportTickets", "CharacterName", "TEXT NULL", ct);
        await TryAddColumnAsync(db, "Users", "AcceptedTermsAt", "TEXT NULL", ct);
        await TryAddColumnAsync(db, "Users", "Bio", "TEXT NULL", ct);
        await TryAddColumnAsync(db, "Users", "AvatarEmoji", "TEXT NULL", ct);
        await TryAddColumnAsync(db, "Users", "AccentColor", "TEXT NULL", ct);
        await EnsureFriendChatTablesAsync(db, ct);
    }

    private static async Task EnsureFriendChatTablesAsync(AppDbContext db, CancellationToken ct)
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

    private static async Task TryAddColumnAsync(
        AppDbContext db,
        string table,
        string column,
        string definition,
        CancellationToken ct
    )
    {
        try
        {
            await db.Database.ExecuteSqlRawAsync(
                $"""ALTER TABLE "{table}" ADD COLUMN "{column}" {definition};""",
                ct
            );
        }
        catch
        {
            // Colonne déjà présente
        }
    }
}
