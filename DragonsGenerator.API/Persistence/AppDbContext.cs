using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Persistence;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<CharacterRecord> Characters => Set<CharacterRecord>();
    public DbSet<SupportTicket> SupportTickets => Set<SupportTicket>();
    public DbSet<Friendship> Friendships => Set<Friendship>();
    public DbSet<CampaignRecord> Campaigns => Set<CampaignRecord>();
    public DbSet<CampaignMember> CampaignMembers => Set<CampaignMember>();
    public DbSet<CampaignInvite> CampaignInvites => Set<CampaignInvite>();
    public DbSet<FriendMessage> FriendMessages => Set<FriendMessage>();
    public DbSet<FriendChatRead> FriendChatReads => Set<FriendChatRead>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AppUser>(e =>
        {
            e.HasIndex(x => x.Email).IsUnique();
            e.Property(x => x.Email).HasMaxLength(256);
            e.Property(x => x.Role).HasMaxLength(32);
            e.Property(x => x.DisplayName).HasMaxLength(128);
            e.Property(x => x.Bio).HasMaxLength(280);
            e.Property(x => x.AvatarEmoji).HasMaxLength(64);
            e.Property(x => x.AccentColor).HasMaxLength(16);
        });

        modelBuilder.Entity<CharacterRecord>(e =>
        {
            e.HasOne(x => x.User)
                .WithMany(u => u.Characters)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            e.Property(x => x.Name).HasMaxLength(200);
        });

        modelBuilder.Entity<SupportTicket>(e =>
        {
            e.HasOne(x => x.User)
                .WithMany(u => u.SupportTickets)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            e.Property(x => x.Subject).HasMaxLength(200);
            e.Property(x => x.Status).HasMaxLength(32);
            e.Property(x => x.CharacterName).HasMaxLength(200);
        });

        modelBuilder.Entity<Friendship>(e =>
        {
            e.HasIndex(x => new { x.RequesterId, x.AddresseeId }).IsUnique();
            e.Property(x => x.Status).HasMaxLength(16);
            e.HasOne(x => x.Requester)
                .WithMany(u => u.FriendshipsRequested)
                .HasForeignKey(x => x.RequesterId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Addressee)
                .WithMany(u => u.FriendshipsReceived)
                .HasForeignKey(x => x.AddresseeId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<CampaignRecord>(e =>
        {
            e.Property(x => x.Title).HasMaxLength(200);
            e.HasOne(x => x.Owner)
                .WithMany(u => u.OwnedCampaigns)
                .HasForeignKey(x => x.OwnerUserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<CampaignMember>(e =>
        {
            e.HasIndex(x => new { x.CampaignId, x.UserId }).IsUnique();
            e.Property(x => x.Role).HasMaxLength(16);
            e.Property(x => x.ProposalStatus).HasMaxLength(16);
            e.Property(x => x.ApprovedCharacterName).HasMaxLength(200);
            e.Property(x => x.ProposedCharacterName).HasMaxLength(200);
            e.HasOne(x => x.Campaign)
                .WithMany(c => c.Members)
                .HasForeignKey(x => x.CampaignId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.User)
                .WithMany(u => u.CampaignMemberships)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<CampaignInvite>(e =>
        {
            e.HasIndex(x => new { x.CampaignId, x.InvitedUserId, x.Status });
            e.Property(x => x.Status).HasMaxLength(16);
            e.HasOne(x => x.Campaign)
                .WithMany(c => c.Invites)
                .HasForeignKey(x => x.CampaignId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.InvitedUser)
                .WithMany(u => u.CampaignInvitesReceived)
                .HasForeignKey(x => x.InvitedUserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<FriendMessage>(e =>
        {
            e.Property(x => x.Body).HasMaxLength(2000);
            e.HasIndex(x => new { x.SenderId, x.RecipientId, x.CreatedAt });
            e.HasOne(x => x.Sender)
                .WithMany(u => u.FriendMessagesSent)
                .HasForeignKey(x => x.SenderId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Recipient)
                .WithMany(u => u.FriendMessagesReceived)
                .HasForeignKey(x => x.RecipientId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<FriendChatRead>(e =>
        {
            e.HasKey(x => new { x.UserId, x.FriendUserId });
            e.HasOne(x => x.User)
                .WithMany(u => u.FriendChatReads)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.FriendUser)
                .WithMany()
                .HasForeignKey(x => x.FriendUserId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
