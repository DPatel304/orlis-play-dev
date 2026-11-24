/* A heads-up for the owner: a note by the clock (the tray shows it), and - when
   email is set up - the same words emailed to the owner account's address.

     headsUp(db, tell, mail)  ->  (title, text) => void

   The email is fire and forget: it never holds up, or breaks, the request that
   caused it. A mail problem is only logged. */
export function headsUp(db, tell, mail = null){
  return (title, text) => {
    try { tell?.(title, text); } catch (e){ console.log(`heads-up note failed: ${e.message}`); }
    try {
      if (!mail || !mail.ready) return;
      const owner = db.prepare("SELECT email FROM accounts WHERE role = 'owner' ORDER BY created_at LIMIT 1").get();
      if (!owner || !owner.email) return;
      Promise.resolve(mail.send({ to: owner.email, subject: String(title), text: `${text}\n\n- Orlis Server` }))
        .catch((e) => console.log(`heads-up email failed: ${e && e.message}`));
    } catch (e){ console.log(`heads-up email failed: ${e.message}`); }
  };
}
