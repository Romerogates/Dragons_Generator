namespace DragonsGenerator.API.Services;

/// <summary>Modèles HTML type parchemin pour les emails transactionnels.</summary>
public static class AuthEmailTemplates
{
    public static string WrapParchment(string title, string greeting, string bodyHtml, string ctaLabel, string ctaUrl)
    {
        return $"""
            <!DOCTYPE html>
            <html lang="fr">
            <head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
            <body style="margin:0;padding:24px;background:#1a1410;font-family:Georgia,'Times New Roman',serif;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;">
                <tr>
                  <td style="background:linear-gradient(160deg,#f3e6c8 0%,#e8d4a8 45%,#dcc490 100%);border:1px solid #a67c3a;border-radius:8px;padding:28px 24px;color:#2a1f14;box-shadow:0 8px 24px rgba(0,0,0,.35);">
                    <p style="margin:0 0 6px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#7a5a28;">Dragons Generator · Eana</p>
                    <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#5c3d12;">{title}</h1>
                    <p style="margin:0 0 12px;font-size:16px;">{greeting}</p>
                    <div style="font-size:15px;line-height:1.55;color:#3a2a18;">{bodyHtml}</div>
                    <p style="margin:22px 0 8px;text-align:center;">
                      <a href="{ctaUrl}" style="display:inline-block;background:#8b5a1a;color:#f8eed8;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:bold;letter-spacing:.04em;">{ctaLabel}</a>
                    </p>
                    <p style="margin:16px 0 0;font-size:12px;line-height:1.45;color:#6b542f;word-break:break-all;">
                      Ou copiez ce lien :<br/>{ctaUrl}
                    </p>
                    <hr style="border:none;border-top:1px solid #c4a46a;margin:22px 0 12px;"/>
                    <p style="margin:0;font-size:11px;color:#7a6540;">Outil fan non affilié à Agate RPG / Ishtar Games.</p>
                  </td>
                </tr>
              </table>
            </body>
            </html>
            """;
    }

    public static string Confirmation(string displayName, string link) =>
        WrapParchment(
            "Confirmez votre compte",
            $"Bienvenue, {Escape(displayName)}.",
            "<p>Une dernière rune à sceller : confirmez votre adresse email pour activer votre grimoire.</p>",
            "Confirmer mon compte",
            link
        );

    public static string PasswordReset(string displayName, string link) =>
        WrapParchment(
            "Réinitialisation du mot de passe",
            $"Salutations, {Escape(displayName)}.",
            "<p>Une demande de nouveau sceau a été faite pour votre compte. Ce lien expire dans <strong>2 heures</strong>.</p><p>Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.</p>",
            "Choisir un nouveau mot de passe",
            link
        );

    public static string SupportTaken(string displayName, string subject, string link) =>
        WrapParchment(
            "Nous consultons votre demande",
            $"Salutations, {Escape(displayName)}.",
            $"<p>Le support a ouvert votre ticket <strong>{Escape(subject)}</strong> et consulte la situation.</p><p>Vous pouvez répondre dans le fil sur le site si vous avez des précisions.</p>",
            "Ouvrir le ticket",
            link
        );

    public static string SupportReply(string displayName, string subject, string excerpt, string link) =>
        WrapParchment(
            "Réponse du support",
            $"Salutations, {Escape(displayName)}.",
            $"<p>Une réponse a été ajoutée à <strong>{Escape(subject)}</strong>.</p><p style=\"white-space:pre-wrap\">{Escape(excerpt)}</p>",
            "Lire et répondre",
            link
        );

    public static string SupportNewTicket(string subject, string fromEmail, string excerpt, string link) =>
        WrapParchment(
            "Nouveau ticket support",
            "Desk Dragons Generator",
            $"<p>Ticket de <strong>{Escape(fromEmail)}</strong> : <strong>{Escape(subject)}</strong>.</p><p style=\"white-space:pre-wrap\">{Escape(excerpt)}</p>",
            "Ouvrir le desk",
            link
        );

    public static string SessionReminder(string displayName, string title, string details, string link) =>
        WrapParchment(
            title,
            $"Salutations, {Escape(displayName)}.",
            $"<p>{Escape(details)}</p><p>Répondez <strong>Oui / Peut-être / Non</strong> sur le calendrier si ce n’est pas déjà fait.</p>",
            "Ouvrir le calendrier",
            link
        );

    private static string Escape(string value) =>
        System.Net.WebUtility.HtmlEncode(value ?? "");
}
