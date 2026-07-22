(() => {
  "use strict";

  const APPROVED_EMAILS = new Set([
    "dave.moorcroft@nrgex.co.za",
    "richard.wright@nrgex.co.za",
    "jakes.botha@nrgex.co.za",
    "olaf.bergh@nrgex.co.za",
    "matthew.wright@nrgex.co.za",
    "rob.wright@nrgex.co.za"
    
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



  const TRAINING_VIDEOS = [
    {
      title: "Crazy Rallies",
      category: "Match Inspiration",
      description: "Ridiculous retrievals, patient construction and proof that the rally is never over until somebody finally hits the tin.",
      youtubeId: "nTcvGK3k1IQ",
      start: 263
    },
    {
      title: "Stroke or Let?",
      category: "Rules & Refereeing",
      description: "A useful guide to interference, lets and strokes — essential viewing before the next completely impartial office debate.",
      youtubeId: "17IqrJNNvFY",
      start: 0
    },
    {
      title: "Best Warm-up Routines",
      category: "Match Preparation",
      description: "A proper squash warm-up for players who would prefer their first hard movement not to happen at 8–8 in game one.",
      youtubeId: "H8iYJOn4a60",
      start: 0
    },
    {
      title: "Volleys: Early, Important and Tactical",
      category: "Technique & Tactics",
      description: "Take the ball early, hold the T and remove time from your opponent instead of politely waiting at the back wall.",
      youtubeId: "RhVGSsfFmGg",
      start: 136
    },
    {
      title: "Best Squash Serves",
      category: "Fundamentals",
      description: "Use the only shot you control completely to create a weak return and begin the rally with an actual plan.",
      youtubeId: "02JLBs8BRro",
      start: 0
    }
  ];

  const state = {
    players: [],
    leaderboard: [],
    tableSort: "season_points",
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
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unknown date";
    return new Intl.DateTimeFormat("en-ZA", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Africa/Johannesburg"
    }).format(date);
  }

  function currentEmail() {
    return String(state.session?.user?.email || "").trim().toLowerCase();
  }

  function isAdmin() {
    return currentEmail() === "dave.moorcroft@nrgex.co.za";
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
    Jakes: "I have a plan.",
    Rob: "Wright place, wrong time."
  };

  function initials(name) {
    return String(name || "?")
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }



  function trainingVideoUrl(video) {
    const start = video.start ? `&t=${video.start}s` : "";
    return `https://www.youtube.com/watch?v=${video.youtubeId}${start}`;
  }

  function renderTrainingVideos() {
    const grid = el("trainingGrid");
    if (!grid) return;

    grid.innerHTML = TRAINING_VIDEOS.map((video) => `
      <article class="training-card">
        <a class="training-thumbnail" href="${trainingVideoUrl(video)}" target="_blank" rel="noopener noreferrer" aria-label="Watch ${escapeHtml(video.title)} on YouTube">
          <img src="https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg" alt="Thumbnail for ${escapeHtml(video.title)}" loading="lazy" />
          <span class="training-play" aria-hidden="true">▶</span>
        </a>
        <div class="training-card-body">
          <p class="card-label">${escapeHtml(video.category)}</p>
          <h3>${escapeHtml(video.title)}</h3>
          <p>${escapeHtml(video.description)}</p>
          <a class="button secondary small" href="${trainingVideoUrl(video)}" target="_blank" rel="noopener noreferrer">Watch on YouTube</a>
        </div>
      </article>
    `).join("");
  }

  function trainingPopupStorageKey() {
    const identity = currentEmail() || state.session?.user?.id || "league-member";
    return `nrg-training-popup-seen:${identity}`;
  }

  function dismissTrainingPopup() {
    const modal = el("trainingLaunchModal");
    if (!modal) return;
    localStorage.setItem(trainingPopupStorageKey(), "true");
    modal.classList.add("hidden");
    document.body.classList.remove("modal-open");
  }

  function maybeShowTrainingPopup() {
    const modal = el("trainingLaunchModal");
    if (!modal || !state.session) return;
    if (localStorage.getItem(trainingPopupStorageKey()) === "true") return;
    modal.classList.remove("hidden");
    document.body.classList.add("modal-open");
  }

  function setupTrainingPopup() {
    const modal = el("trainingLaunchModal");
    if (!modal) return;

    el("openTrainingButton").addEventListener("click", () => {
      dismissTrainingPopup();
      location.hash = "#training";
    });

    el("dismissTrainingButton").addEventListener("click", dismissTrainingPopup);
    el("closeTrainingModalButton").addEventListener("click", dismissTrainingPopup);

    modal.addEventListener("click", (event) => {
      if (event.target === modal) dismissTrainingPopup();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !modal.classList.contains("hidden")) {
        dismissTrainingPopup();
      }
    });
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
        const wins = Number(stats?.games_won ?? 0);
        const losses = Number(stats?.games_lost ?? 0);
        const played = wins + losses;
        const rating = Math.round(Number(stats?.elo_rating ?? 1000));
        const winRate = played ? Math.round((wins / played) * 100) : 0;

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
              <div><span>Season points</span><strong>${Number(stats?.season_points ?? 0).toFixed(1)}</strong></div>
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
      .select("*");

    if (error) {
      console.error(error);
      el("leagueTableBody").innerHTML = `<tr><td colspan="8">Could not load the table: ${escapeHtml(error.message)}</td></tr>`;
      el("seasonLeaderCard").textContent = "Standings unavailable.";
      el("eloLeaderCard").textContent = "Standings unavailable.";
      return;
    }

    renderLeaderboard(data || []);
  }

  function renderLeaderboard(rows) {
    state.leaderboard = rows || [];
    renderPlayers();

    if (!state.leaderboard.length) {
      el("leagueTableBody").innerHTML = `<tr><td colspan="8">No results yet. The league remains scientifically inconclusive.</td></tr>`;
      el("seasonLeaderCard").innerHTML = `<p>No season leader yet.</p>`;
      el("eloLeaderCard").innerHTML = `<p>No Elo leader yet.</p>`;
      return;
    }

    const sortedRows = [...state.leaderboard].sort((a, b) => {
      if (state.tableSort === "elo_rating") {
        return (
          Number(b.elo_rating ?? 1000) - Number(a.elo_rating ?? 1000) ||
          Number(b.season_points ?? 0) - Number(a.season_points ?? 0) ||
          String(a.display_name ?? "").localeCompare(String(b.display_name ?? ""))
        );
      }

      return (
        Number(b.season_points ?? 0) - Number(a.season_points ?? 0) ||
        Number(b.elo_rating ?? 1000) - Number(a.elo_rating ?? 1000) ||
        String(a.display_name ?? "").localeCompare(String(b.display_name ?? ""))
      );
    });

    el("leagueTableBody").innerHTML = sortedRows
      .map((row, index) => {
        const wins = Number(row.games_won ?? 0);
        const losses = Number(row.games_lost ?? 0);
        const played = Number(row.games_played ?? (wins + losses));
        const participation = Number(row.participation_points ?? 0);
        const seasonPoints = Number(row.season_points ?? 0);
        const rating = Math.round(Number(row.elo_rating ?? 1000));

        return `
          <tr>
            <td><span class="rank-number">${index + 1}</span></td>
            <td><strong>${escapeHtml(row.display_name)}</strong></td>
            <td>${played}</td>
            <td>${wins}</td>
            <td>${losses}</td>
            <td>${participation.toFixed(1)}</td>
            <td>${seasonPoints.toFixed(1)}</td>
            <td class="rating-cell">${rating}</td>
          </tr>
        `;
      })
      .join("");

    const seasonLeader = [...state.leaderboard].sort((a, b) => {
      return (
        Number(b.season_points ?? 0) - Number(a.season_points ?? 0) ||
        Number(b.elo_rating ?? 1000) - Number(a.elo_rating ?? 1000) ||
        String(a.display_name ?? "").localeCompare(String(b.display_name ?? ""))
      );
    })[0];

    const eloLeader = [...state.leaderboard].sort((a, b) => {
      return (
        Number(b.elo_rating ?? 1000) - Number(a.elo_rating ?? 1000) ||
        Number(b.season_points ?? 0) - Number(a.season_points ?? 0) ||
        String(a.display_name ?? "").localeCompare(String(b.display_name ?? ""))
      );
    })[0];

    el("seasonLeaderCard").classList.remove("loading");
    el("seasonLeaderCard").innerHTML = `
      <p class="card-label">SEASON POINTS LEADER</p>
      <h3>${escapeHtml(seasonLeader.display_name)}</h3>
      <div class="rating">${Number(seasonLeader.season_points ?? 0).toFixed(1)} points</div>
      <p class="muted">
        Elo ${Math.round(Number(seasonLeader.elo_rating ?? 1000))},
        ${Number(seasonLeader.games_won ?? 0)} games won and
        ${Number(seasonLeader.games_lost ?? 0)} games lost.
      </p>
    `;

    el("eloLeaderCard").classList.remove("loading");
    el("eloLeaderCard").innerHTML = `
      <p class="card-label">ELO LEADER</p>
      <h3>${escapeHtml(eloLeader.display_name)}</h3>
      <div class="rating">${Math.round(Number(eloLeader.elo_rating ?? 1000))} Elo</div>
      <p class="muted">
        ${Number(eloLeader.season_points ?? 0).toFixed(1)} season points,
        ${Number(eloLeader.games_won ?? 0)} games won and
        ${Number(eloLeader.games_lost ?? 0)} games lost.
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
              isAdmin()
                ? `<div class="result-actions">
                    <button
                      class="button secondary small edit-result-button"
                      data-match-id="${match.id}"
                      data-player-a="${escapeHtml(match.player_a_name)}"
                      data-player-b="${escapeHtml(match.player_b_name)}"
                      data-games-a="${match.player_a_games}"
                      data-games-b="${match.player_b_games}"
                    >Edit result</button>
                    <button
                      class="button danger small delete-result-button"
                      data-match-id="${match.id}"
                      data-player-a="${escapeHtml(match.player_a_name)}"
                      data-player-b="${escapeHtml(match.player_b_name)}"
                      data-games-a="${match.player_a_games}"
                      data-games-b="${match.player_b_games}"
                    >Delete</button>
                  </div>`
                : ""
            }
          </article>
        `;
      })
      .join("");

    document.querySelectorAll(".edit-result-button").forEach((button) => {
      button.addEventListener("click", () => editResult(button));
    });

    document.querySelectorAll(".delete-result-button").forEach((button) => {
      button.addEventListener("click", () => deleteResult(button));
    });
  }

  async function editResult(button) {
    if (!state.session || !isAdmin()) {
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
      gamesB < 0
    ) {
      window.alert("Enter valid whole-number game totals.");
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
      p_match_id: matchId,
      p_player_a_games: Number(playerAGames),
      p_player_b_games: Number(playerBGames)
    });
    
    if (error) {
      console.error("Edit match error:", error);
      alert(`Could not edit result: ${error.message}`);
      return;
    }

    await Promise.all([loadLeaderboard(), loadResults()]);
    window.alert("Result corrected and Elo history recalculated.");
  }


  async function deleteResult(button) {
    if (!state.session || !isAdmin()) {
      window.alert("Only Dave's administrator login can delete results.");
      return;
    }

    const description = `${button.dataset.playerA} ${button.dataset.gamesA}–${button.dataset.gamesB} ${button.dataset.playerB}`;
    const confirmed = window.confirm(
      `Delete this result permanently?

${description}

All standings and Elo ratings will be recalculated.`
    );
    if (!confirmed) return;

    button.disabled = true;
    button.textContent = "Deleting…";

    const { error } = await supabaseClient.rpc("admin_delete_match", {
      p_match_id: button.dataset.matchId
    });

    if (error) {
      console.error(error);
      window.alert(error.message);
      button.disabled = false;
      button.textContent = "Delete";
      return;
    }

    await Promise.all([loadLeaderboard(), loadResults()]);
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

    const aPoints = gamesA + 0.5;
    const bPoints = gamesB + 0.5;
    const outcome =
      gamesA > gamesB
        ? `Winner: ${playerA.display_name}`
        : gamesB > gamesA
          ? `Winner: ${playerB.display_name}`
          : "Result: Draw";

    el("matchPreview").innerHTML = `
      <strong>${escapeHtml(playerA.display_name)} ${gamesA}–${gamesB} ${escapeHtml(playerB.display_name)}</strong><br>
      Season points for this match: ${escapeHtml(playerA.display_name)} ${aPoints.toFixed(1)},
      ${escapeHtml(playerB.display_name)} ${bPoints.toFixed(1)}.<br>
      ${escapeHtml(outcome)}. Official Elo changes will be calculated by Supabase.
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

    if (!Number.isInteger(gamesA) || !Number.isInteger(gamesB) || gamesA < 0 || gamesB < 0) {
      setMessage(el("formMessage"), "Enter valid whole-number game totals.", "error");
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
    window.setTimeout(maybeShowTrainingPopup, 250);

    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
      state.session = session;
      await loadMyMembership();
      updateAuthUI(session);
      if (session) window.setTimeout(maybeShowTrainingPopup, 250);
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
      window.setTimeout(maybeShowTrainingPopup, 300);
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
    el("seasonLeaderCard").textContent = message;
    el("eloLeaderCard").textContent = message;
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

    el("tableSortSelect").addEventListener("change", (event) => {
      state.tableSort = event.target.value === "elo_rating"
        ? "elo_rating"
        : "season_points";
      renderLeaderboard(state.leaderboard);
    });
  }

  async function init() {
    setupNavigation();
    renderTrainingVideos();
    setupTrainingPopup();
    setDefaultDate();
    setupEvents();
    el("tableSortSelect").value = state.tableSort;
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
