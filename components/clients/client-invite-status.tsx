const messages: Record<string, { tone: "success" | "warning" | "error"; text: string }> = {
  sent: { tone: "success", text: "Invite email sent." },
  resent: { tone: "success", text: "A new password setup email was sent." },
  active: { tone: "success", text: "This trainee has already completed account setup." },
  error: { tone: "error", text: "The authentication email could not be sent. Check the server logs for the Supabase error code." },
  "email-exists": { tone: "error", text: "This email already belongs to another Supabase Auth account. Use a different email, or remove the unused Auth user before inviting again." },
  "email-not-authorized": { tone: "error", text: "Supabase cannot send to this address with its default email service. Check the configured SMTP service and try again." },
  "invalid-email": { tone: "error", text: "Supabase rejected this email address. Check it for mistakes and avoid example or test-only domains." },
  "email-disabled": { tone: "error", text: "Email authentication is disabled in Supabase. Enable the email provider before sending trainee invitations." },
  "rate-limited": { tone: "warning", text: "Supabase temporarily limited authentication emails. Wait a few minutes before trying again." },
  "account-missing": { tone: "error", text: "The linked Auth account no longer exists. Refresh this page and send a new invitation." },
  "account-mismatch": { tone: "error", text: "The trainee email no longer matches the linked Auth account. Restore the original email or contact an administrator before sending another setup link." },
  "missing-email": { tone: "warning", text: "Add an email to this trainee before sending an invite." }
};

const toneClasses = {
  success: "border-success/40 bg-success/5 text-success",
  warning: "border-warning/40 bg-warning/5 text-warning",
  error: "border-destructive/25 bg-card text-destructive"
};

export function ClientInviteStatus({ status }: { status?: string }) {
  if (!status || !messages[status]) return null;
  const message = messages[status];
  return (
    <div className={`rounded-md border px-4 py-3 text-sm shadow-soft ${toneClasses[message.tone]}`} role="status">
      {message.text}
    </div>
  );
}
