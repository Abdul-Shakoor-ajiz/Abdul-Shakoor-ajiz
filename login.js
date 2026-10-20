(() => {
  const form = document.getElementById('loginForm');
  const message = document.getElementById('message');
  const button = document.getElementById('loginButton');
  function show(text) { message.hidden = false; message.textContent = text; }
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!window.supabase || !window.SUPABASE_URL || window.SUPABASE_URL.includes('YOUR-PROJECT-REF') || !window.SUPABASE_ANON_KEY || window.SUPABASE_ANON_KEY.includes('YOUR_SUPABASE')) {
      show('Setup is not finished. Open supabase-config.js and add your Supabase Project URL and anon/publishable key.'); return;
    }
    button.disabled = true; button.textContent = 'Signing in…';
    try {
      const client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
      const { data, error } = await client.auth.signInWithPassword({
        email: document.getElementById('email').value.trim(),
        password: document.getElementById('password').value
      });
      if (error) throw error;
      const { data: profile, error: profileError } = await client.from('profiles').select('full_name, role').eq('id', data.user.id).single();
      if (profileError || !profile) { await client.auth.signOut(); throw new Error('Your account has no school profile yet. Ask the administrator to finish setting it up.'); }
      const selectedRole = document.getElementById('role').value;
      if (profile.role !== selectedRole) { await client.auth.signOut(); throw new Error('This account is registered as ' + profile.role + ', not ' + selectedRole + '. Choose the correct portal.'); }
      window.location.href = 'portal.html';
    } catch (error) { show(error.message || 'Could not sign in. Check your details and try again.'); }
    finally { button.disabled = false; button.textContent = 'Sign in securely'; }
  });
})();
