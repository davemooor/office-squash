(() => {
  "use strict";

  const APPROVED_EMAILS = new Set([
    "dave.moorcroft@nrgex.co.za",
    "richard.wright@nrgex.co.za",
    "jakes.botha@nrgex.co.za",
    "olaf.bergh@nrgex.co.za",
    "matthew.wright@nrgex.co.za"
  ]);

  const config = window.NRG_CONFIG || {};
  const isConfigured =
    config.SUPABASE_URL &&
    config.SUPABASE_PUBLISHABLE_KEY &&
    !config.SUPABASE_URL.includes("YOUR-PROJECT") &&
    !config.SUPABASE_PUBLISHABLE_KEY.includes("YOUR_SUPABASE");

  const supabaseClient = isConfigured
    ? window.supabase.createClient(
        config.SUPABASE_URL,
        config.SUPABASE_PUBLISHABLE_KEY
      )
    : null;

  const state = {
    players: [],
    leaderboard: [],
    session: null,
    membership: null
  };

  const el = (id) => document.getElementById(id);

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDate(value) {
    if (!value) return "Unknown date";
    return new Intl.DateTimeFormat("en-ZA", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(value));
  }

  function setMessage(element, message, type = "") {
    element.textContent = message;
    element.className = `form-message ${type}`.trim();
  }

  const PLAYER_MOTTOS = {
    Olaf: "Pressure is for everyone else.",
    Richard: "Trust the percentages.",
    Matthew: "I'm just here for the exercise...",
    Dave: "One more YouTube video should do it.",
    Jakes: "I have a plan."
  };

  function initials(name) {
    return String(name || "?")
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }

  function setupNavigation() {
    const sections = [...document.querySelectorAll(".page-section")];
    const navLinks = [...document.querySelectorAll("nav a")];

    function showSection() {
      const targetId = location.hash.replace("#", "") || "home";
      const target = document.getElementById(targetId) || document.getElementById("home");

      sections.forEach((section) => section.classList.toggle("active", section === target));
      navLinks.forEach((link) => {
        link.classList.toggle("active", link.getAttribute("href") === `#${target.id}`);
      });

      el("mainNav").classList.remove("open");
      window.scrollTo({ top: 0, behavior: "instant" });
    }

    window.addEventListener("hashchange", showSection);
    el("menuButton").addEventListener("click", () => {
      el("mainNav").classList.toggle("open");
    });

    showSection();
  }

  function setDefaultDate() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    el("playedAt").value = now.toISOString().slice(0, 16);
  }

  async function loadPlayers() {
    if (!supabaseClient) {
      renderConfigurationMessage();
      return;
    }

    const { data, error } = await supabaseClient
      .from("players")
      .select("id, name, nickname, biography, current_rating, photo_url, is_active")
      .eq("is_active", true)
      .order("name");

    if (error) {
      console.error(error);
      el("playersGrid").innerHTML = `<article class="player-card">Could not load players: ${escapeHtml(error.message)}</article>`;
      return;
    }

    state.players = (data || []).map(player => ({
      ...player,
      display_name: player.name,
      bio: player.biography,
      elo_rating: player.current_rating
    }));
    populatePlayerSelects();
    renderPlayers();
  }

  function populatePlayerSelects() {
    const options = state.players
      .map((player) => `<option value="${player.id}">${escapeHtml(player.display_name)}</option>`)
      .join("");

    ["playerA", "playerB"].forEach((id) => {
      el(id).innerHTML = `<option value="">Select player</option>${options}`;
    });
  }

  function renderPlayers() {
    if (!state.players.length) {
      el("playersGrid").innerHTML = `<article class="player-card">No active players have been added yet.</article>`;
      return;
    }

    el("playersGrid").innerHTML = state.players
      .map((player) => {
        const stats = state.leaderboard.find((row) => row.player_id === player.id);
        const wins = Number(stats?.games_won || 0);
        const losses = Number(stats?.games_lost || 0);
        const played = wins + losses;
        const rating = Math.round(Number(stats?.elo_rating || 1000));
        const totalGames = wins + losses;
        const winRate = totalGames ? Math.round((wins / totalGames) * 100) : 0;

        return `
          <article class="player-card profile-card">
            <div class="profile-header">
              <div class="player-avatar">${escapeHtml(initials(player.display_name))}</div>
              <div>
                <h3>${escapeHtml(player.display_name)}</h3>
                <div class="nickname">${escapeHtml(player.nickname || "Unbranded competitor")}</div>
              </div>
            </div>

            <p class="profile-bio">${escapeHtml(player.bio || "Biography pending legal approval.")}</p>

            <div class="career-motto">
              <span>Career Motto</span>
              <blockquote>“${escapeHtml(PLAYER_MOTTOS[player.display_name] || "The court will decide.")}”</blockquote>
            </div>

            <div class="profile-stats">
              <div><span>Office Champ</span><strong>${rating}</strong></div>
              <div><span>Played</span><strong>${played}</strong></div>
              <div><span>Won</span><strong>${wins}</strong></div>
              <div><span>Lost</span><strong>${losses}</strong></div>
              <div><span>Win rate</span><strong>${winRate}%</strong></div>
              <div><span>Season points</span><strong>${Number(stats?.league_points || 0).toFixed(1)}</strong></div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  async function loadLeaderboard() {
    if (!supabaseClient) {
      renderConfigurationMessage();
      return;
    }

    const { data, error } = await supabaseClient
      .from("leaderboard")
      .select("*")
      .order("elo_rating", { ascending: false });

    if (error) {
      console.error(error);
      el("leagueTableBody").innerHTML = `<tr><td colspan="8">Could not load the table: ${escapeHtml(error.message)}</td></tr>`;
      el("leaderCard").textContent = "Standings unavailable.";
      return;
    }

    renderLeaderboard(data || []);
  }

  function renderLeaderboard(rows) {
    state.leaderboard = rows || [];
    renderPlayers();

    if (!rows.length) {
      el("leagueTableBody").innerHTML = `<tr><td colspan="8">No results yet. The league remains scientifically inconclusive.</td></tr>`;
      el("leaderCard").innerHTML = `<p>No leader yet.</p>`;
      return;
    }

    el("leagueTableBody").innerHTML = rows
      .map(
        (row, index) => `
          <tr>
            <td><span class="rank-number">${index + 1}</span></td>
            <td><strong>${escapeHtml(row.display_name)}</strong></td>
            <td>${Number(row.games_won || 0) + Number(row.games_lost || 0)}</td>
            <td>${row.games_won}</td>
            <td>${row.games_lost}</td>
            <td>${row.participation_points}</td>
            <td>${Number(row.season_points ?? row.league_points).toFixed(1)}</td>
            <td class="rating-cell">${Math.round(Number(row.elo_rating))}</td>
          </tr>
        `
      )
      .join("");

    const leader = rows[0];
    el("leaderCard").innerHTML = `
      <h3>${escapeHtml(leader.display_name)}</h3>
      <div class="rating">${Math.round(Number(leader.elo_rating))} Office Champ</div>
      <p class="muted">
       ${leader.games_won} games won, ${leader.games_lost} games lost,
       ${Number(leader.games_won || 0) + Number(leader.games_lost || 0)} games played.
      </p>
    `;
  }

  async function loadResults() {
    if (!supabaseClient) {
      renderConfigurationMessage();
      return;
    }

    const { data, error } = await supabaseClient
      .from("match_results")
      .select("*")
      .order("played_at", { ascending: false })
      .limit(30);

    if (error) {
      console.error(error);
      el("resultsList").innerHTML = `<article class="result-card">Could not load results: ${escapeHtml(error.message)}</article>`;
      return;
    }

    renderResults(data || []);
  }

  function renderResults(rows) {
    if (!rows.length) {
      el("resultsList").innerHTML = `<article class="result-card">No results have been submitted yet.</article>`;
      return;
    }

    el("resultsList").innerHTML = rows
      .map((match) => {
        const aChange = Number(match.player_a_rating_change || 0);
        const bChange = Number(match.player_b_rating_change || 0);

        return `
          <article class="result-card">
            <p class="eyebrow">${escapeHtml(formatDate(match.played_at))}</p>
            <div class="result-score">
              <span>${escapeHtml(match.player_a_name)}</span>
              <strong>${match.player_a_games}</strong>
              <span>${escapeHtml(match.player_b_name)}</span>
              <strong>${match.player_b_games}</strong>
            </div>
            <p class="result-meta">${escapeHtml(match.venue || "Venue not recorded")}</p>
            <p>
              <span class="rating-change ${aChange >= 0 ? "positive" : "negative"}">
                ${escapeHtml(match.player_a_name)} ${aChange >= 0 ? "+" : ""}${aChange.toFixed(1)}
              </span>
              ·
              <span class="rating-change ${bChange >= 0 ? "positive" : "negative"}">
                ${escapeHtml(match.player_b_name)} ${bChange >= 0 ? "+" : ""}${bChange.toFixed(1)}
              </span>
            </p>
            ${match.notes ? `<p class="muted">${escapeHtml(match.notes)}</p>` : ""}
            ${
              state.membership?.email === "dave.moorcroft@nrgex.co.za"
                ? `<button
                    class="button secondary small edit-result-button"
                    data-match-id="${match.id}"
                    data-player-a="${escapeHtml(match.player_a_name)}"
                    data-player-b="${escapeHtml(match.player_b_name)}"
                    data-games-a="${match.player_a_games}"
                    data-games-b="${match.player_b_games}"
                  >Edit result</button>`
                : ""
            }
          </article>
        `;
      })
      .join("");

    document.querySelectorAll(".edit-result-button").forEach((button) => {
      button.addEventListener("click", () => editResult(button));
    });
  }

  async function editResult(button) {
    if (!state.session || state.membership?.email !== "dave.moorcroft@nrgex.co.za") {
      window.alert("Only Dave's administrator login can correct historical results.");
      return;
    }

    const playerA = button.dataset.playerA;
    const playerB = button.dataset.playerB;
    const currentA = button.dataset.gamesA;
    const currentB = button.dataset.gamesB;

    const gamesAInput = window.prompt(`Correct games won by ${playerA}:`, currentA);
    if (gamesAInput === null) return;

    const gamesBInput = window.prompt(`Correct games won by ${playerB}:`, currentB);
    if (gamesBInput === null) return;

    const gamesA = Number(gamesAInput);
    const gamesB = Number(gamesBInput);

    if (
      !Number.isInteger(gamesA) ||
      !Number.isInteger(gamesB) ||
      gamesA < 0 ||
      gamesB < 0 ||
      gamesA === gamesB
    ) {
      window.alert("Enter valid whole-number game totals. The match cannot be drawn.");
      return;
    }

    const confirmed = window.confirm(
      `Change ${playerA} ${currentA}–${currentB} ${playerB} to ${gamesA}–${gamesB}?\n\n` +
      "All Elo changes from this match onward will be recalculated."
    );

    if (!confirmed) return;

    button.disabled = true;
    button.textContent = "Recalculating…";

    const { error } = await supabaseClient.rpc("admin_edit_match", {
      p_match_id: button.dataset.matchId,
      p_player_a_games: gamesA,
      p_player_b_games: gamesB
    });

    if (error) {
      console.error(error);
      window.alert(error.message);
      button.disabled = false;
      button.textContent = "Edit result";
      return;
    }

    await Promise.all([loadLeaderboard(), loadResults()]);
    window.alert("Result corrected and Elo history recalculated.");
  }

  function updateMatchPreview() {
    const playerA = state.players.find((p) => p.id === el("playerA").value);
    const playerB = state.players.find((p) => p.id === el("playerB").value);
    const gamesA = Number(el("playerAGames").value);
    const gamesB = Number(el("playerBGames").value);

    if (!playerA || !playerB || Number.isNaN(gamesA) || Number.isNaN(gamesB)) {
      el("matchPreview").textContent = "Select two players and enter the result.";
      return;
    }

    if (playerA.id === playerB.id) {
      el("matchPreview").textContent = "A player cannot play against himself, regardless of internal conflict.";
      return;
    }

    if (gamesA === gamesB) {
      el("matchPreview").textContent = "The match cannot be drawn.";
      return;
    }

    const aPoints = gamesA + 0.5;
    const bPoints = gamesB + 0.5;
    const winner = gamesA > gamesB ? playerA.display_name : playerB.display_name;

    el("matchPreview").innerHTML = `
      <strong>${escapeHtml(playerA.display_name)} ${gamesA}–${gamesB} ${escapeHtml(playerB.display_name)}</strong><br>
      Season points for this match: ${escapeHtml(playerA.display_name)} ${aPoints.toFixed(1)},
      ${escapeHtml(playerB.display_name)} ${bPoints.toFixed(1)}.<br>
      Winner: ${escapeHtml(winner)}. Official Elo changes will be calculated by Supabase.
    `;
  }

  async function submitMatch(event) {
    event.preventDefault();

    if (!supabaseClient) {
      setMessage(el("formMessage"), "Add your Supabase details to config.js first.", "error");
      return;
    }

    if (!state.session) {
      setMessage(el("formMessage"), "Please log in before submitting a result.", "error");
      location.hash = "#login";
      return;
    }

    const playerAId = el("playerA").value;
    const playerBId = el("playerB").value;
    const gamesA = Number(el("playerAGames").value);
    const gamesB = Number(el("playerBGames").value);

    if (!playerAId || !playerBId || playerAId === playerBId) {
      setMessage(el("formMessage"), "Choose two different players.", "error");
      return;
    }

    if (!Number.isInteger(gamesA) || !Number.isInteger(gamesB) || gamesA < 0 || gamesB < 0 || gamesA === gamesB) {
      setMessage(el("formMessage"), "Enter a valid non-drawn match score.", "error");
      return;
    }

    const submitButton = event.submitter;
    submitButton.disabled = true;
    setMessage(el("formMessage"), "Submitting result…");

    const { data, error } = await supabaseClient.rpc("submit_match", {
      p_player_a_id: playerAId,
      p_player_b_id: playerBId,
      p_player_a_games: gamesA,
      p_player_b_games: gamesB,
      p_played_at: new Date(el("playedAt").value).toISOString(),
      p_venue: el("venue").value.trim() || null,
      p_notes: el("notes").value.trim() || null
    });

    submitButton.disabled = false;

    if (error) {
      console.error(error);
      setMessage(el("formMessage"), error.message, "error");
      return;
    }

    setMessage(el("formMessage"), `Result submitted. Match reference: ${data}`, "success");
    el("matchForm").reset();
    setDefaultDate();
    updateMatchPreview();
    await Promise.all([loadLeaderboard(), loadResults()]);
  }

  async function setupAuth() {
    if (!supabaseClient) {
      updateAuthUI(null);
      return;
    }

    const { data } = await supabaseClient.auth.getSession();
    state.session = data.session;
    await loadMyMembership();
    updateAuthUI(state.session);

    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
      state.session = session;
      await loadMyMembership();
      updateAuthUI(session);
    });

    el("loginForm").addEventListener("submit", async (event) => {
      event.preventDefault();

      const email = el("loginEmail").value.trim().toLowerCase();
      const password = el("loginPassword").value;

      if (!APPROVED_EMAILS.has(email)) {
        setMessage(
          el("loginMessage"),
          "That email address is not on the approved office league list.",
          "error"
        );
        return;
      }

      if (!password) {
        setMessage(el("loginMessage"), "Enter your password.", "error");
        return;
      }

      const submitButton = event.submitter;
      submitButton.disabled = true;
      setMessage(el("loginMessage"), "Signing in…");

      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

      submitButton.disabled = false;

      if (error || !data?.session) {
        setMessage(
          el("loginMessage"),
          "Login failed. Check the email address and password.",
          "error"
        );
        return;
      }

      // Store the session immediately. This avoids a race where the page
      // changes section before the auth-state callback has finished.
      state.session = data.session;
      await loadMyMembership();
      updateAuthUI(state.session);

      el("loginPassword").value = "";
      setMessage(el("loginMessage"), "Signed in successfully.", "success");
      location.hash = "#table";
    });

    el("logoutButton").addEventListener("click", async () => {
      await supabaseClient.auth.signOut();
      location.hash = "#home";
    });
  }

  async function loadMyMembership() {
    state.membership = null;

    if (!supabaseClient || !state.session) return;

    const { data, error } = await supabaseClient.rpc("get_my_membership");

    if (error) {
      console.error("Membership lookup failed:", error);
      return;
    }

    state.membership = Array.isArray(data) ? data[0] || null : data || null;

    if (state.membership) {
      await loadResults();
    }
  }

  function updateAuthUI(session) {
    const loggedIn = Boolean(session);
    el("loggedOutPanel").classList.toggle("hidden", loggedIn);
    el("loggedInPanel").classList.toggle("hidden", !loggedIn);
    el("authWarning").classList.toggle("hidden", loggedIn);
    const identity = state.membership
      ? `${state.membership.display_name} (${session?.user?.email || ""})`
      : session?.user?.email || "";

    el("loggedInEmail").textContent = identity;
    el("loginNavLink").textContent = loggedIn ? "Account" : "Login";

    if (loggedIn && !state.membership) {
      setMessage(
        el("loginMessage"),
        "You are authenticated with Supabase, but this email is not an approved league member.",
        "error"
      );
    }
  }

  function renderConfigurationMessage() {
    const message = "Supabase is not configured yet. Add your project URL and publishable key to config.js.";
    el("leagueTableBody").innerHTML = `<tr><td colspan="8">${escapeHtml(message)}</td></tr>`;
    el("leaderCard").textContent = message;
    el("resultsList").innerHTML = `<article class="result-card">${escapeHtml(message)}</article>`;
    el("playersGrid").innerHTML = `<article class="player-card">${escapeHtml(message)}</article>`;
  }

  function setupEvents() {
    ["playerA", "playerB", "playerAGames", "playerBGames"].forEach((id) => {
      el(id).addEventListener("input", updateMatchPreview);
      el(id).addEventListener("change", updateMatchPreview);
    });

    el("matchForm").addEventListener("submit", submitMatch);
    el("refreshTableButton").addEventListener("click", loadLeaderboard);
    el("refreshResultsButton").addEventListener("click", loadResults);
  }

  async function init() {
    setupNavigation();
    setDefaultDate();
    setupEvents();
    await setupAuth();

    if (supabaseClient) {
      await Promise.all([loadPlayers(), loadLeaderboard(), loadResults()]);
    } else {
      renderConfigurationMessage();
    }
  }

  init().catch((error) => {
    console.error("Application startup failed:", error);
  });
})();
