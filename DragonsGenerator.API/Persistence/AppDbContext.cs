using Microsoft.EntityFrameworkCore;

namespace DragonsGenerator.API.Persistence;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<CharacterRecord> Characters => Set<CharacterRecord>();
    public DbSet<SupportTicket> SupportTickets => Set<SupportTicket>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AppUser>(e =>
        {
            e.HasIndex(x => x.Email).IsUnique();
            e.Property(x => x.Email).HasMaxLength(256);
            e.Property(x => x.Role).HasMaxLength(32);
            e.Property(x => x.DisplayName).HasMaxLength(128);
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
        });
    }
}
