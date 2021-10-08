/* jshint esversion: 8 */

var REFRESH_TIME = 300;
var VERBOSE = true;

var canvasDiv = document.getElementById("canvas-div");
var gameContainer = document.getElementById("game-container");
var canvasContainer = document.getElementById("canvas-container");
var canvas = document.getElementById("main-canvas");
var eventLog = document.getElementById("event-log");
var chatIn = document.getElementById("chat-in");
var copyInvite = document.getElementById("copy-invite");
var cardPile = document.getElementById("card-pile");
var cardPileText = document.getElementById("card-pile-text");
var playerList = document.getElementById("player-list");
var roomIDEl = document.getElementById("room-id-display");

var ctx = canvas.getContext("2d");

let storage = {};

chatIn.onkeyup = event => {
	if(event.key == "Enter" && event.target.value.trim() != "") {
		if(storage.selfID != null) {
			if(isPlayerDead(storage.selfID)) {
				new Popup("Chat is currently disabled because you are dead")
					.addButton("Okay")
					.show();
				return;
			}
			let p = new PacketClientChatMessage();
			p.setMessage(event.target.value);
			event.target.value = "";
			Network.sendPacket(Packet.of(p));
		}
	}
};

copyInvite.onclick = event => {
	if(storage.selfID != null) {
		if(navigator.clipboard != null) {
			let link = window.location.protocol + "//" + window.location.host + window.location.pathname + "?" + storage.room.getID();
			navigator.clipboard.writeText(link).then(() => {
				Popup.ofTitleAndText("Invite", "Copied invite link to clipboard")
					.addButton("Okay")
					.show();
			});
		}else {
			let c = document.createElement("input");
			c.value = window.location.protocol + "//" + window.location.host + window.location.pathname + "?" + storage.room.getID();
			document.body.appendChild(c);
			c.focus();
			c.select();
			document.execCommand('copy');
			c.remove();
			Popup.ofTitleAndText("Invite", "Copied invite link to clipboard")
				.addButton("Okay")
				.show();
		}
	}
};

function redirect(url) {
	window.open(url,'_blank');
}

resetPage();

function createRoom() {
	document.getElementById("room-container").style.display = "none";
	document.getElementById("room-create-container").style.display = "block";
	storage.createRoom = true;
	/*new Popup("Popup", "This is some popup text")
		.addButton("Okay")
		.addHideButton()
		.show();*/
}

function joinRoom() {
	document.getElementById("room-container").style.display = "none";
	document.getElementById("room-join-container").style.display = "block";
	storage.createRoom = false;
}

function rejoinRoom() {
	let sessID = localStorage.sessionID;
	if(sessID == null) {
		Popup.ofTitleAndText("Error", "No session available to rejoin").addButton("Okay").show();
		return;
	}

	document.getElementById("room-container").style.display = "none";
	document.getElementById("play-container").style.display = "none";
	storage.sessionID = sessID;
	play();
}

function joinRoomConfirm() {
	let roomID = document.getElementById("room-id").value;
	if(roomID == "") {
		Popup.ofTitleAndText("Error", "You need to input a room id").addButton("Okay").show();
		return;
	}

	document.getElementById("room-join-container").style.display = "none";
	document.getElementById("play-container").style.display = "block";

	storage.roomID = roomID;
}

function createRoomConfirm() {
	let roomName = document.getElementById("room-name").value;
	if(roomName == "") {
		Popup.ofTitleAndText("Error", "You need to input a room name").addButton("Okay").show();
		return;
	}

	document.getElementById("room-create-container").style.display = "none";
	document.getElementById("play-container").style.display = "block";

	storage.roomName = roomName;
	storage.roomSettings = {};
	storage.roomSettings.mode = document.getElementById("game-mode").value;
}

function nameConfirm() {
	let name = document.getElementById("username").value.trim();
	if(name == "") {
		Popup.ofTitleAndText("Error", "You need to input a username").addButton("Okay").show();
		return;
	}

	if(!(/^(?:[a-zA-Z0-9äöü]){1,20}$/.test(name))) {
		Popup.ofTitleAndText("Error", "Username contains invalid characters or is too long").addButton("Okay").show();
		return;
	}

	document.getElementById("play-container").style.display = "none";

	storage.username = name;

	play();
}

function resetPage() {
	for(let el of document.getElementsByClassName("full")) {
		el.style.display = "none";
	}

	for(let inp of document.getElementsByClassName("input")) {
		let def = inp.getAttribute("data-default");
		inp.value = def == null ? "" : def;
	}

	eventLog.value = "";

	gameContainer.style.display = "none";

	document.getElementById("play-container").style.display = "none";

	document.getElementById("room-container").style.display = "block";

	if(window.location.search != "" && window.location.search != "?") {
		let roomID = window.location.search.substr(1);
		if(!(/^\d{4,6}$/.test(roomID))) return;
		document.getElementById("room-id").value = roomID;
		joinRoom();
		joinRoomConfirm();
	}
}

function displayError(message) {
	let txt = document.createElement("div");
	txt.classList.add("full", "message");
	txt.innerText = message;
	txt.style.zIndex = "1";
	document.body.appendChild(txt);
}

async function play() {
	try {
		await Network.init(VERBOSE);
	}catch(e) {
		displayError("Connection failed");
		console.log(e);
		return;
	}

	let conPacket = new PacketClientConnect();

	if(storage.sessionID) {
		conPacket.setSessionID(storage.sessionID);
	}else {
		conPacket.setPlayerName(storage.username);
		conPacket.setCreateRoom(storage.createRoom);
		conPacket.setRoomID(storage.roomID);
		conPacket.setRoomName(storage.roomName);

		if(storage.roomSettings) {
			let roomSettings = new RoomSettings();
			roomSettings.setMode(storage.roomSettings.mode);

			if(storage.roomSettings.mode == "SECRET_REICHSTAG") {
				roomSettings.setCommunistCardCount(11);
				roomSettings.setFascistCardCount(11);
				roomSettings.setLiberalCardCount(9);
			}else if(storage.roomSettings.mode == "SECRET_HITLER") {
				roomSettings.setCommunistCardCount(0);
				roomSettings.setFascistCardCount(11);
				roomSettings.setLiberalCardCount(6);
			}

			conPacket.setRoomSettings(roomSettings);
		}
	}

	storage = {};

	prepareCanvas();

	Network.sendPacket(Packet.of(conPacket)).then(response => {
		if(PacketServerJoinError.isInstance(response.getData())) {
			displayError("Error: " + response.getData().getMessage());
			return;
		}

		gameContainer.style.display = "block";

		let room = response.getData().getRoom();
		let selfPlayer = response.getData().getSelfPlayer();
		let sessionID = response.getData().getSessionID();

		if(response.getData().isVoteDone()) storage.selfVoted = true;

		localStorage.sessionID = sessionID;

		storage.room = room;
		storage.selfPlayer = selfPlayer;
		storage.roomID = room.getID();
		storage.selfID = selfPlayer.getID();
		storage.hand = {
			cards: [],
			selected: []
		}

		roomIDEl.innerText = "Room #" + room.getID();

		document.getElementById("btn-reset").remove();

		if(VERBOSE) console.log("Loading assets...");
		storage.assets = {
			cArticle: loadImage("article/communist.png"),
			fArticle: loadImage("article/fascist.png"),
			lArticle: loadImage("article/liberal.png"),
			articleBack: loadImage("article/back.png"),

			iconWin: {
				FASCIST: loadImage("icon/icon-win-f.png"),
				COMMUNIST: loadImage("icon/icon-win-c.png"),
				LIBERAL: null
			},

			iconPlayerBlocked: loadImage("icon/icon-player-blocked.png"),
			iconPreviousPresident: loadImage("icon/icon-player-previous-president.png"),
			iconPreviousChancellor: loadImage("icon/icon-player-previous-chancellor.png"),
			iconPresident: loadImage("icon/icon-president.png"),
			iconChancellor: loadImage("icon/icon-chancellor.png"),
			iconYes: loadImage("icon/icon-yes.png"),
			iconNo: loadImage("icon/icon-no.png"),
			iconDead: loadImage("icon/icon-dead.png"),
			iconNotHitler: loadImage("icon/icon-not-hitler.png"),
			iconNotStalin: loadImage("icon/icon-not-stalin.png"),
			iconConnection: loadImage("icon/connection.png"),

			iconRole: {
				LIBERAL: loadImage("icon/role-liberal.png"),
				STALIN: loadImage("icon/role-stalin.png"),
				COMMUNIST: loadImage("icon/role-communist.png"),
				HITLER: loadImage("icon/role-hitler.png"),
				FASCIST: loadImage("icon/role-fascist.png"),
			},

			actions: {
				KILL_PLAYER: {
					COMMUNIST: loadImage("icon/icon-kill-c.png"),
					FASCIST: loadImage("icon/icon-kill-f.png"),
				},
				INSPECT_PLAYER: {
					COMMUNIST: loadImage("icon/icon-inspect-c.png"),
					FASCIST: loadImage("icon/icon-inspect-f.png"),
				},
				BLOCK_PLAYER: {
					COMMUNIST: loadImage("icon/icon-block-c.png"),
					FASCIST: loadImage("icon/icon-block-f.png"),
				},
				EXAMINE_TOP_CARDS: {
					COMMUNIST: loadImage("icon/icon-top-cards-c.png"),
					FASCIST: loadImage("icon/icon-top-cards-f.png"),
				},
				EXAMINE_TOP_CARDS_OTHER: {
					COMMUNIST: loadImage("icon/icon-top-cards-other-c.png"),
					FASCIST: loadImage("icon/icon-top-cards-other-f.png"),
				},
				PICK_PRESIDENT: {
					COMMUNIST: loadImage("icon/icon-pick-president-c.png"),
					FASCIST: loadImage("icon/icon-pick-president-f.png"),
				}
			}

		}

		storage.assets.article = {
			COMMUNIST: storage.assets.cArticle,
			FASCIST: storage.assets.fArticle,
			LIBERAL: storage.assets.lArticle,
		}

		storage.colors = {
			teammate: {
				COMMUNIST: "darkred",
				FASCIST: "#a35c2f"
			},
			leader: {
				COMMUNIST: "#660000",
				FASCIST: "#693b1e"
			},
			role: {
				LIBERAL: "#004e6e",
				COMMUNIST: "darkred",
				FASCIST: "#a35c2f",
				HITLER: "#693b1e",
				STALIN: "#660000"
			},
			board: {
				background: "#363835",
				infoText: "#ffa200",
				COMMUNIST: {
					outerFill: "darkred",
					unsafeFill: "#660000",
					cardBackground: "#c25439",
					title: "#bf0003"
				},
				FASCIST: {
					outerFill: "#a35c2f",
					unsafeFill: "#693b1e",
					cardBackground: "#7d4624",
					title: "#693b1e"
				},
				LIBERAL: {
					outerFill: "#61c8d9",
					cardBackground: "#004e6e",
					title: "#004e6e",
					electionTrackerActive: "#FFFF00",
					electionTrackerInactive: "#FFFFFF"
				}
			}
		}

		updatePlayerList();
		updateCardPile();

		setInterval(draw, REFRESH_TIME);
		window.onresize = draw;
	
		if(VERBOSE) console.log("Done!");
	});

	Network.setPacketListener(packet => {
		if(VERBOSE) console.log("received", packet);

		if(PacketServerPlayerJoined.isInstance(packet.getData())) {
			if(packet.getData().isRejoin()) {
				for(let i = 0; i < storage.room.getPlayers().length; i++) {
					let pl = storage.room.getPlayers()[i];
					if(packet.getData().getPlayer().getID() == pl.getID()) {
						pl.online = true;
						break;
					}
				}
			}else {
				storage.room.getPlayers().push(packet.getData().getPlayer());
				updatePlayerList();
			}

			createStartButtonIfNeeded();
		}

		if(PacketServerPlayerLeft.isInstance(packet.getData())) {

			for(let i = 0; i < storage.room.getPlayers().length; i++) {
				let pl = storage.room.getPlayers()[i];
				if(packet.getData().getPlayer().getID() == pl.getID()) {
					if(packet.getData().isHardLeave()) {
						storage.room.getPlayers().splice(i, 1);
					}else {
						pl.online = false;
					}
					updatePlayerList();
					break;
				}
			}

			if(storage.room.getPlayers().length < storage.room.getMode().getMinPlayers()) removeStartButton();
		}

		if(PacketServerPauseGame.isInstance(packet.getData())) {
			storage.room.setGamePaused(true);
		}

		if(PacketServerUnpauseGame.isInstance(packet.getData())) {
			storage.room.setGamePaused(false);
		}


		if(PacketServerStopGame.isInstance(packet.getData())) {
			storage.selfRole = null;
			storage.partyPopup = null;
			storage.room.setGameRunning(false);

			clearClickables();
			clearHoverables();

			for(let p of storage.room.getPlayers()) {
				p.isTeammate = null;
				p.isLeader = null;
				p.vote = null;
				p.wasRole = packet.getData().roles[p.getID()];
			}

			let unitPixel = canvas.width / 1920;
			let playerListX = canvas.width / 5 * 4 + unitPixel * 10;
			let playerListY = unitPixel * 50;
			let playerListWidth = canvas.width / 5 - unitPixel * 20;
			let playerListHeight = unitPixel * 60 * 14; // 14 players max

			let bt = createButton("Dismiss roles", playerListX, playerListY + playerListHeight, playerListWidth, unitPixel * 50, b => {
				bt.remove();

				for(let p of storage.room.getPlayers()) {
					p.wasRole = null;
				}
			});

			if(packet.getData().getWinner() != null) {
				let unitPixel = canvas.width / 1920;

				storage.winner = packet.getData().getWinner();

				createButton("Dismiss", canvas.width / 2 - unitPixel * 200, canvas.height / 2 + unitPixel * 100, unitPixel * 400, unitPixel * 50, b => {
					storage.winner = null;
					b.remove();
					createStartButtonIfNeeded();
				});
			}
		}

		if(PacketServerStartGame.isInstance(packet.getData())) {
			let d = packet.getData();

			clearClickables();
			clearHoverables();
			storage.winner = null;

			storage.selfRole = d.getRole();
			storage.room.setGameRunning(true);
			
			if(d.getTeammates() != null) {
				for(let t of d.getTeammates()) {
					for(let p of storage.room.getPlayers()) {
						if(p.getID() != t.getID()) continue;
						p.isTeammate = true;
						break;
					}
				}
			}

			for(let p of storage.room.getPlayers()) {
				p.wasRole = null;
			}
			
			if(d.getLeader() != null) {
				for(let p of storage.room.getPlayers()) {
					if(p.getID() != d.getLeader().getID()) continue;
					p.isLeader = true;
					break;
				}
			}

			updatePlayerList();
		}

		if(PacketServerEventLogEntry.isInstance(packet.getData())) {
			let d = packet.getData();
			eventLog.value += (d.isChatMessage() ? "" : "- ") + d.getMessage() + "\n";

			eventLog.scrollTop = eventLog.scrollHeight;
		}

		if(PacketServerUpdateGameState.isInstance(packet.getData())) {
			if(storage.room == null) return; // We're most likely not connected yet

			clearStateBoundObjects();

			let s = packet.getData().getNewState();
			storage.room.setGameState(s);
			updatePlayerList();
			updateCardPile();

			if(s.getMoveState() != GameMoveState.VOTE) storage.selfVoted = null;

			if(s.getMoveState() == GameMoveState.DRAW_CARDS && s.getPresident().getID() == storage.selfID) {
				let unitPixel = canvas.width / 1920;
				let cardWidth = unitPixel * 150;
				let cardHeight = cardWidth * 1.45;

				let drawPileX = canvas.width / 5 - unitPixel * 20 - cardWidth;
				let drawPileY = canvas.height / 2 - cardHeight / 2;
				
				createButton("Draw", drawPileX, drawPileY + cardHeight + unitPixel * 20, cardWidth, unitPixel * 40, btn => {
					if(isGamePaused()) return;
					Network.sendPacket(Packet.of(new PacketClientDrawCards()));
					btn.remove();
				}, true);
			}else if(s.getMoveState() == GameMoveState.SELECT_CHANCELLOR && s.getPresident().getID() == storage.selfID) {
				let unitPixel = canvas.width / 1920;
				let playerListX = canvas.width / 5 * 4 + unitPixel * 10;
				let playerListY = unitPixel * 50;
				let playerListWidth = canvas.width / 5 - unitPixel * 20;

				let buttons = [];
				for(let i = 0; i < storage.room.getPlayers().length; i++) {
					let player = storage.room.getPlayers()[i];

					if(player.getID() == storage.selfID) continue;

					let s = storage.room.getGameState();
					if(s.getPreviousPresident() != null && player.getID() == s.getPreviousPresident().getID()) continue;
					if(s.getPreviousChancellor() != null && player.getID() == s.getPreviousChancellor().getID()) continue;
					if(s.getBlockedPlayer() != null && player.getID() == s.getBlockedPlayer().getID()) continue;
					if(isPlayerDead(player.getID())) continue;

					buttons.push(createButton("Select", playerListX + playerListWidth / 3 * 2 + unitPixel * 10, playerListY + unitPixel * 60 * i + unitPixel * 5, playerListWidth / 3 - unitPixel * 20, unitPixel * 50, () => {
						if(isGamePaused()) return;
						for(let b of buttons) b.remove();
						
						let p = new PacketClientSelectChancellor();
						p.setPlayerID(player.getID());
						Network.sendPacket(Packet.of(p));
					}, true));
				}
			}else if(s.getMoveState() == GameMoveState.VOTE) {
				if(isPlayerDead(storage.selfID) || storage.selfVoted) return;

				let unitPixel = canvas.width / 1920;
				let buttons = [];

				buttons.push(createButton("Vote Yes", canvas.width / 2 - unitPixel * 205, canvas.height - unitPixel * 100, unitPixel * 200, unitPixel * 100, () => {
					if(isGamePaused()) return;
					for(let b of buttons) b.remove();

					let p = new PacketClientVote();
					p.setYes(true);
					Network.sendPacket(Packet.of(p));
					storage.selfVoted = true;
				}, true));

				buttons.push(createButton("Vote No", canvas.width / 2 + unitPixel * 5, canvas.height - unitPixel * 100, unitPixel * 200, unitPixel * 100, () => {
					if(isGamePaused()) return;
					for(let b of buttons) b.remove();

					let p = new PacketClientVote();
					p.setYes(false);
					Network.sendPacket(Packet.of(p));
					storage.selfVoted = true;
				}, true));
			}
		}

		if(PacketServerVoteResults.isInstance(packet.getData())) {
			let unitPixel = canvas.width / 1920;
			let playerListX = canvas.width / 5 * 4 + unitPixel * 10;
			let playerListY = unitPixel * 50;
			let playerListWidth = canvas.width / 5 - unitPixel * 20;
			let playerListHeight = unitPixel * 60 * 14; // 14 players max

			for(let pID in packet.getData().getVotes()) {
				let isYes = packet.getData().getVotes()[pID];
				let pl;
				for(let p of storage.room.getPlayers()) {
					if(p.getID() == pID) {
						pl = p;
						break;
					}
				}
				if(pl == null) continue;
				pl.vote = isYes;
			}

			for(let btn of document.getElementsByClassName("dismiss-vote-results")) btn.remove();

			let bt = createButton("Dismiss vote results", playerListX, playerListY + playerListHeight, playerListWidth, unitPixel * 50, b => {
				b.remove();

				for(let p of storage.room.getPlayers()) {
					p.vote = null;
				}
			});

			bt.classList.add("dismiss-vote-results");
		}

		if(PacketServerPlayerAction.isInstance(packet.getData())) {
			let d = packet.getData();
			switch(d.getAction()) {
				case GameBoardAction.EXAMINE_TOP_CARDS:
				{
					let unitPixel = canvas.width / 1920;
					let cardWidth = unitPixel * 150;
					let cardHeight = cardWidth * 1.45;

					let drawPileX = canvas.width / 5 - unitPixel * 20 - cardWidth;
					let drawPileY = canvas.height / 2 - cardHeight / 2;
					
					createButton("Inspect", drawPileX, drawPileY + cardHeight + unitPixel * 20, cardWidth, unitPixel * 40, btn => {
						if(isGamePaused()) return;
						storage.hand.cards = d.getData().getCards();
						btn.remove();

						createButton("Confirm", canvas.width / 2 - unitPixel * 100, canvas.height - cardHeight - unitPixel * 50, unitPixel * 200, unitPixel * 50, btn2 => {
							if(isGamePaused()) return;
							btn2.remove();
							storage.hand.cards = [];

							let p = new PacketClientPerformAction();
							Network.sendPacket(Packet.of(p));
						});
					});

					break;
				}
				case GameBoardAction.EXAMINE_TOP_CARDS_OTHER:
				{
					let unitPixel = canvas.width / 1920;
					let playerListX = canvas.width / 5 * 4 + unitPixel * 10;
					let playerListY = unitPixel * 50;
					let playerListWidth = canvas.width / 5 - unitPixel * 20;
	
					let buttons = [];
					for(let i = 0; i < storage.room.getPlayers().length; i++) {
						let player = storage.room.getPlayers()[i];
	
						if(player.getID() == storage.selfID) continue;
						if(isPlayerDead(player.getID())) continue;
	
						buttons.push(createButton("Select", playerListX + playerListWidth / 3 * 2 + unitPixel * 10, playerListY + unitPixel * 60 * i + unitPixel * 5, playerListWidth / 3 - unitPixel * 20, unitPixel * 50, () => {
							if(isGamePaused()) return;
							for(let b of buttons) b.remove();

							let p = new PacketClientPerformAction();
							let a = new ActionExamineTopCardsOther();

							a.setPlayerID(player.getID());
							p.setData(a);
							
							Network.sendPacket(Packet.of(p));
						}));
					}
					break;
				}
				case GameBoardAction.KILL_PLAYER:
				{
					let unitPixel = canvas.width / 1920;
					let playerListX = canvas.width / 5 * 4 + unitPixel * 10;
					let playerListY = unitPixel * 50;
					let playerListWidth = canvas.width / 5 - unitPixel * 20;
	
					let buttons = [];
					for(let i = 0; i < storage.room.getPlayers().length; i++) {
						let player = storage.room.getPlayers()[i];
	
						if(player.getID() == storage.selfID) continue;
						if(isPlayerDead(player.getID())) continue;
	
						buttons.push(createButton("Kill", playerListX + playerListWidth / 3 * 2 + unitPixel * 10, playerListY + unitPixel * 60 * i + unitPixel * 5, playerListWidth / 3 - unitPixel * 20, unitPixel * 50, () => {
							if(isGamePaused()) return;
							for(let b of buttons) b.remove();

							let p = new PacketClientPerformAction();
							let a = new ActionKillPlayer();

							a.setPlayerID(player.getID());
							p.setData(a);
							
							Network.sendPacket(Packet.of(p));
						}));
					}
					break;
				}
				case GameBoardAction.PICK_PRESIDENT:
				{
					let unitPixel = canvas.width / 1920;
					let playerListX = canvas.width / 5 * 4 + unitPixel * 10;
					let playerListY = unitPixel * 50;
					let playerListWidth = canvas.width / 5 - unitPixel * 20;
	
					let buttons = [];
					for(let i = 0; i < storage.room.getPlayers().length; i++) {
						let player = storage.room.getPlayers()[i];
	
						if(player.getID() == storage.selfID) continue;
						if(isPlayerDead(player.getID())) continue;
	
						buttons.push(createButton("Select", playerListX + playerListWidth / 3 * 2 + unitPixel * 10, playerListY + unitPixel * 60 * i + unitPixel * 5, playerListWidth / 3 - unitPixel * 20, unitPixel * 50, () => {
							if(isGamePaused()) return;
							for(let b of buttons) b.remove();

							let p = new PacketClientPerformAction();
							let a = new ActionPickPresident();

							a.setPlayerID(player.getID());
							p.setData(a);
							
							Network.sendPacket(Packet.of(p));
						}));
					}
					break;
				}
				case GameBoardAction.INSPECT_PLAYER:
				{
					let unitPixel = canvas.width / 1920;
					let playerListX = canvas.width / 5 * 4 + unitPixel * 10;
					let playerListY = unitPixel * 50;
					let playerListWidth = canvas.width / 5 - unitPixel * 20;
	
					let buttons = [];
					for(let i = 0; i < storage.room.getPlayers().length; i++) {
						let player = storage.room.getPlayers()[i];
	
						if(player.getID() == storage.selfID) continue;
						if(isPlayerDead(player.getID())) continue;
	
						buttons.push(createButton("Inspect", playerListX + playerListWidth / 3 * 2 + unitPixel * 10, playerListY + unitPixel * 60 * i + unitPixel * 5, playerListWidth / 3 - unitPixel * 20, unitPixel * 50, () => {
							if(isGamePaused()) return;
							for(let b of buttons) b.remove();

							let p = new PacketClientPerformAction();
							let a = new ActionInspectPlayer();

							a.setPlayerID(player.getID());
							p.setData(a);
							
							Network.sendPacket(Packet.of(p)).then(response => {
								let party = response.getData().getParty();
								storage.partyPopup = {player: player, party: party};

								createButton("Dismiss", canvas.width / 2 - unitPixel * 200, canvas.height / 2 + unitPixel * 100, unitPixel * 400, unitPixel * 50, b => {
									storage.partyPopup = null;
									b.remove();
								});
							});
						}));
					}
					break;
				}
				case GameBoardAction.BLOCK_PLAYER:
				{
					let unitPixel = canvas.width / 1920;
					let playerListX = canvas.width / 5 * 4 + unitPixel * 10;
					let playerListY = unitPixel * 50;
					let playerListWidth = canvas.width / 5 - unitPixel * 20;
	
					let buttons = [];
					for(let i = 0; i < storage.room.getPlayers().length; i++) {
						let player = storage.room.getPlayers()[i];

						let s = storage.room.getGameState();

						if(player.getID() == storage.selfID) continue;
						if(isPlayerDead(player.getID())) continue;
						if(player.getID() == s.getChancellor().getID()) continue;
						if(player.getID() == s.getPresident().getID() && storage.room.getPlayers().length >= 8) continue;

						buttons.push(createButton("Block", playerListX + playerListWidth / 3 * 2 + unitPixel * 10, playerListY + unitPixel * 60 * i + unitPixel * 5, playerListWidth / 3 - unitPixel * 20, unitPixel * 50, () => {
							if(isGamePaused()) return;
							for(let b of buttons) b.remove();

							let p = new PacketClientPerformAction();
							let a = new ActionBlockPlayer();

							a.setPlayerID(player.getID());
							p.setData(a);

							Network.sendPacket(Packet.of(p));
						}));
					}
					break;
				}
			}
		}

		if(PacketServerPickCards.isInstance(packet.getData())) {
			storage.hand.cards = packet.getData().getCards();
			let unitPixel = canvas.width / 1920;
			let cardWidth = unitPixel * 150;
			let cardHeight = cardWidth * 1.45;

			let cardSpacingH = unitPixel * 10;
			let x = canvas.width / 2 - storage.hand.cards.length * (cardWidth + cardSpacingH) / 2;

			let areas = [];
			for(let i = 0; i < storage.hand.cards.length; i++) {
				areas.push(createClickableArea(x + i * (cardWidth + cardSpacingH) + cardSpacingH / 2, canvas.height - cardHeight + cardSpacingH / 2, cardWidth, cardHeight, () => {
					if(storage.hand.selected.indexOf(i) != -1) {
						removeFromArray(storage.hand.selected, i);
					}else {
						storage.hand.selected.push(i);
					}
				}, "Card #" + (i + 1)));
			}

			let s = storage.room.getGameState();
			let vetoButton = !packet.getData().isVetoBlocked() && s.getChancellor().getID() == storage.selfID && s.isVetoPowerUnlocked();
			let buttons = [];

			buttons.push(createButton("Confirm", canvas.width / 2 - unitPixel * (vetoButton ? 200 : 100), canvas.height - cardHeight - unitPixel * 50, unitPixel * 200, unitPixel * 50, () => {
				if(isGamePaused()) return;
				if(storage.hand.selected.length != 1) {
					alert("Select exactly 1 card to be discarded");
					return;
				}

				for(let btn of buttons) btn.remove();
				for(let area of areas) area.remove();

				let discardIndex = storage.hand.selected[0];

				storage.hand.cards = [];
				storage.hand.selected = [];

				let p = new PacketClientDiscardCard();
				p.setDiscardIndex(discardIndex);
				Network.sendPacket(Packet.of(p));
			}));

			if(vetoButton) {
				buttons.push(createButton("Veto", canvas.width / 2, canvas.height - cardHeight - unitPixel * 50, unitPixel * 200, unitPixel * 50, () => {
					if(isGamePaused()) return;
					for(let btn of buttons) btn.remove();
					for(let area of areas) area.remove();

					storage.hand.cards = [];
					storage.hand.selected = [];

					let p = new PacketClientVeto();
					Network.sendPacket(Packet.of(p));
				}));
			}
		}

		if(PacketServerVeto.isInstance(packet.getData())) {
			let unitPixel = canvas.width / 1920;
			let buttons = [];

			buttons.push(createButton("Accept Veto", canvas.width / 2 - unitPixel * 205, canvas.height - unitPixel * 100, unitPixel * 200, unitPixel * 100, () => {
				if(isGamePaused()) return;
				for(let b of buttons) b.remove();

				let p = new PacketClientVeto();
				p.setAcceptVeto(true);
				Network.sendPacket(Packet.of(p));
			}));

			buttons.push(createButton("Decline Veto", canvas.width / 2 + unitPixel * 5, canvas.height - unitPixel * 100, unitPixel * 200, unitPixel * 100, () => {
				if(isGamePaused()) return;
				for(let b of buttons) b.remove();

				let p = new PacketClientVeto();
				p.setAcceptVeto(false);
				Network.sendPacket(Packet.of(p));
			}));
		}
	});
}

function createStartButtonIfNeeded() {
	let mode = storage.room.getMode();
	if(storage.room.getPlayers().length >= mode.getMinPlayers()) {
		if(storage.room.isGameRunning()) return;
		if(storage.room.getPlayers()[0].getID() != storage.selfID) return;
		let unitPixel = canvas.width / 1920;

		removeStartButton();

		let b = createButton("Start Game", canvas.width / 2 - unitPixel * 200, canvas.height / 2 - unitPixel * 100, unitPixel * 400, unitPixel * 200, button => {
			button.remove();

			Network.sendPacket(Packet.of(new PacketClientStartGame()));
		});
		b.classList.add("start-button");
	}
}

function removeStartButton() {
	for(let b of document.getElementsByClassName("start-button")) b.remove();
}

function prepareCanvas() {
	if(storage.room == null) return;

	// Size + Position the canvas to always have the correct aspect ratio
	let numBoards = storage.room.getMode() == GameMode.SECRET_HITLER ? 2 : 3;
	let aspectRatio = 3 / numBoards;

	let containerWidth = canvasContainer.clientWidth;
	let containerHeight = canvasContainer.clientHeight;

	canvas.style.position = "absolute";
	if(containerWidth / containerHeight > aspectRatio) {
		canvas.height = containerHeight;
		canvas.width = containerHeight * aspectRatio;

		canvasDiv.style.height = containerHeight;
		canvasDiv.style.width = containerHeight * aspectRatio;
		canvasDiv.style.left = (containerWidth - canvas.width) / 2;
		canvasDiv.style.top = 0;
	}else {
		canvas.width = containerWidth;
		canvas.height = containerWidth / aspectRatio;

		canvasDiv.style.width = containerWidth;
		canvasDiv.style.height = containerWidth / aspectRatio;
		canvasDiv.style.top = (containerHeight - canvas.height) / 2;
		canvasDiv.style.left = 0;
	}

	let singleBoardHeight = canvas.height / numBoards;
	cardPile.style.width = singleBoardHeight * 3 / 5 / 1.45;
}

function draw() {
	prepareCanvas();

	let unitPixel = canvas.width / 1920;
	let cardWidth = unitPixel * 150;
	let cardHeight = cardWidth * 1.45;
	let cardSpacing = unitPixel * 20;

	let gameState = storage.room.getGameState();

	ctx.fillStyle = "lightgray";
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	ctx.fillStyle = "black";
	ctx.font = "normal bold " + unitPixel * 30 + "px Germania One";
	ctx.textAlign = "left";
	ctx.textBaseline = "top";
	ctx.fillText("Room " + storage.roomID, unitPixel * 5, unitPixel * 5);

	let mode = storage.room.getMode();
	let boardHeight = storage.room.getMode() == GameMode.SECRET_HITLER ? canvas.height / 2 : canvas.height / 3;

	// Liberal track

	drawBoard(ctx, GameParty.LIBERAL, 0, 0, canvas.width, boardHeight);

	// Communist track

	if(mode == GameMode.SECRET_REICHSTAG) drawBoard(ctx, GameParty.COMMUNIST, 0, canvas.height * 1 / 3, canvas.width, boardHeight);

	// Fascist track

	let fascistBoardOffset = mode == GameMode.SECRET_REICHSTAG ? 0 : -boardHeight;

	drawBoard(ctx, GameParty.FASCIST, 0, fascistBoardOffset + 2 * boardHeight, canvas.width, boardHeight);

	/*
	// Draw pile
	
	let drawPileX = canvas.width / 5 - unitPixel * 20 - cardWidth;
	let drawPileY = canvas.height / 2 - cardHeight / 2;

	ctx.fillStyle = "gray";
	for(let i = Math.min(gameState.getDrawPileSize() - 1, 2); i >= 0; i--) {
		ctx.fillRect(drawPileX + unitPixel * 4 * i, drawPileY + unitPixel * 4 * i, cardWidth + unitPixel * 1, cardHeight + unitPixel * 1);
		drawImageWithBounds(storage.assets.articleBack, drawPileX + unitPixel * 4 * i, drawPileY + unitPixel * 4 * i, cardWidth, cardHeight);
	}

	ctx.fillStyle = "white";
	ctx.font = "normal bold " + unitPixel * 40 + "px Germania One";
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillText(gameState.getDrawPileSize(), drawPileX + cardWidth / 2, drawPileY + cardHeight / 2 + unitPixel * 50);

	// Role

	if(storage.selfRole) {
		ctx.fillStyle = storage.colors.role[storage.selfRole.name()];
		ctx.textAlign = "left";
		ctx.fillText(storage.selfRole.name(), canvas.width / 5 * 4 + unitPixel * 10, unitPixel * 25);
	}

	// Player list

	let playerListX = canvas.width / 5 * 4 + unitPixel * 10;
	let playerListY = unitPixel * 50;
	let playerListWidth = canvas.width / 5 - unitPixel * 20;
	let playerListHeight = unitPixel * 60 * 14; // 14 players max

	ctx.fillStyle = "#363835";
	ctx.fillRect(playerListX, playerListY, playerListWidth, playerListHeight);

	ctx.fillStyle = "white";
	ctx.textAlign = "left";
	ctx.font = "normal bold " + unitPixel * 20 + "px Germania One";
	for(let i = 0; i < storage.room.getPlayers().length; i++) {
		let player = storage.room.getPlayers()[i];
		let playerName = player.getName().substr(0, 20); // TODO

		let isDead = isPlayerDead(player.getID());

		if(player.getID() == storage.selfID) {
			ctx.fillStyle = "green";
		}else if(storage.selfRole) {
			let partyName = storage.selfRole.getParty().name();

			let pColor = "white";

			if(player.isLeader) {
				pColor = storage.colors.leader[partyName];
			}

			if(player.isTeammate) {
				pColor = storage.colors.teammate[partyName];
			}

			ctx.fillStyle = pColor;
		}else {
			ctx.fillStyle = "white";
		}

		if(!player.online) {
			ctx.fillStyle = "orangered";
		}

		ctx.fillText(playerName + (isDead ? " (Dead)" : ""), playerListX + unitPixel * 10, playerListY + unitPixel * 60 * i + unitPixel * 15);

		if(isDead) {
			ctx.fillRect(playerListX + unitPixel * 10, playerListY + unitPixel * 60 * i + unitPixel * 15, ctx.measureText(playerName).width, 2);
		}

		let s = storage.room.getGameState();
		let iconX = playerListX + unitPixel * 10;
		let iconOffsetX = 0;
		let iconY = playerListY + unitPixel * 60 * i + unitPixel * 30;
		let iconSize = unitPixel * 25;

		if(!player.online) {
			drawImageWithBounds(storage.assets.iconConnection, iconX + iconOffsetX, iconY, iconSize, iconSize);
			iconOffsetX += iconSize + unitPixel * 5;
		}

		if(s.getPresident() != null && s.getPresident().getID() == player.getID()) {
			drawImageWithBounds(storage.assets.iconPresident, iconX + iconOffsetX, iconY, iconSize, iconSize);
			iconOffsetX += iconSize + unitPixel * 5;
		}

		if(s.getChancellor() != null && s.getChancellor().getID() == player.getID()) {
			drawImageWithBounds(storage.assets.iconChancellor, iconX + iconOffsetX, iconY, iconSize, iconSize);
			iconOffsetX += iconSize + unitPixel * 5;
		}

		if(s.getPreviousPresident() != null && s.getPreviousPresident().getID() == player.getID()) {
			drawImageWithBounds(storage.assets.iconPreviousPresident, iconX + iconOffsetX, iconY, iconSize, iconSize);
			iconOffsetX += iconSize + unitPixel * 5;
		}

		if(s.getPreviousChancellor() != null && s.getPreviousChancellor().getID() == player.getID()) {
			drawImageWithBounds(storage.assets.iconPreviousChancellor, iconX + iconOffsetX, iconY, iconSize, iconSize);
			iconOffsetX += iconSize + unitPixel * 5;
		}

		if(s.getBlockedPlayer() != null && s.getBlockedPlayer().getID() == player.getID()) {
			drawImageWithBounds(storage.assets.iconPlayerBlocked, iconX + iconOffsetX, iconY, iconSize, iconSize);
			iconOffsetX += iconSize + unitPixel * 5;
		}

		if(isDead) {
			drawImageWithBounds(storage.assets.iconDead, iconX + iconOffsetX, iconY, iconSize, iconSize);
			iconOffsetX += iconSize + unitPixel * 5;
		}

		if(isPlayerNotHitlerConfirmed(player.getID())) {
			drawImageWithBounds(storage.assets.iconNotHitler, iconX + iconOffsetX, iconY, iconSize, iconSize);
			iconOffsetX += iconSize + unitPixel * 5;
		}

		if(isPlayerNotStalinConfirmed(player.getID())) {
			drawImageWithBounds(storage.assets.iconNotStalin, iconX + iconOffsetX, iconY, iconSize, iconSize);
			iconOffsetX += iconSize + unitPixel * 5;
		}

		if(player.vote != null) {
			drawImageWithBounds(player.vote ? storage.assets.iconYes : storage.assets.iconNo, iconX + iconOffsetX, iconY, iconSize, iconSize);
			iconOffsetX += iconSize + unitPixel * 5;
		}

		if(player.wasRole != null) {
			drawImageWithBounds(storage.assets.iconRole[player.wasRole.name()], iconX + iconOffsetX, iconY, iconSize, iconSize);
			iconOffsetX += iconSize + unitPixel * 5;
		}

		ctx.fillStyle = "lightgray";
		ctx.fillRect(playerListX + unitPixel * 10, playerListY + unitPixel * 60 * i + unitPixel * 60 - unitPixel, playerListWidth - unitPixel * 20, unitPixel * 2);
	}

	// Hand

	if(storage.hand.cards.length != 0) {
		let cardSpacingH = unitPixel * 10;
		ctx.fillStyle = "#363835";
		let x = canvas.width / 2 - storage.hand.cards.length * (cardWidth + cardSpacingH) / 2;
		ctx.fillRect(x, canvas.height - cardHeight, storage.hand.cards.length * (cardWidth + cardSpacingH), cardHeight);
		for(let i = 0; i < storage.hand.cards.length; i++) {
			let selected = storage.hand.selected.indexOf(i) != -1;
			drawImageWithBounds(selected ? storage.assets.articleBack : storage.assets.article[storage.hand.cards[i].name()], x + i * (cardWidth + cardSpacingH) + cardSpacingH / 2, canvas.height - cardHeight + cardSpacingH / 2, cardWidth, cardHeight);
		}
	}


	// Party membership popup

	if(storage.partyPopup != null) {
		ctx.fillStyle = "#363835";
		ctx.fillRect(canvas.width / 2 - unitPixel * 200, canvas.height / 2 - unitPixel * 100, unitPixel * 400, unitPixel * 200);
		
		ctx.fillStyle = "white";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.font = "normal bold " + unitPixel * 30 + "px Germania One";

		ctx.fillText(storage.partyPopup.player.getName(), canvas.width / 2, canvas.height / 2 - unitPixel * 15);
		ctx.fillText("Membership: " + storage.partyPopup.party.name(), canvas.width / 2, canvas.height / 2 + unitPixel * 15);
	}

	// Winning screen

	if(storage.winner != null) {
		ctx.fillStyle = "#363835";
		ctx.fillRect(canvas.width / 2 - unitPixel * 200, canvas.height / 2 - unitPixel * 100, unitPixel * 400, unitPixel * 200);

		ctx.fillStyle = "white";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.font = "normal bold " + unitPixel * 30 + "px Germania One";

		ctx.fillText("Winner: " + storage.winner.getFriendlyName(), canvas.width / 2, canvas.height / 2);
	}
	*/

}

function updateCardPile() {
	cardPileText.innerText = storage.room.getGameState().getDrawPileSize();
}

function updatePlayerList() {
	while(playerList.firstChild) playerList.firstChild.remove();

	for(let player of storage.room.getPlayers()) {
		let playerEl = document.createElement("div");
		playerEl.classList.add("player-list-element");

		let nameEl = document.createElement("a");
		nameEl.innerText = player.getName();
		playerEl.appendChild(nameEl);

		let s = storage.room.getGameState();
		let isDead = isPlayerDead(player.getID());

		nameEl.style.textDecoration = isDead ? "line-through" : "none";

		if(player.getID() == storage.selfID) {
			nameEl.style.color = "green";
		}else if(storage.selfRole) {
			let partyName = storage.selfRole.getParty().name();

			let pColor = "white";

			if(player.isLeader) {
				pColor = storage.colors.leader[partyName];
			}

			if(player.isTeammate) {
				pColor = storage.colors.teammate[partyName];
			}

			nameEl.style.color = pColor;
		}else {
			nameEl.style.color = "white";
		}

		if(!player.online) {
			addIcon(playerEl, storage.assets.iconConnection);
		}
	
		if(s.getPresident() != null && s.getPresident().getID() == player.getID()) {
			addIcon(playerEl, storage.assets.iconPresident);
		}
	
		if(s.getChancellor() != null && s.getChancellor().getID() == player.getID()) {
			addIcon(playerEl, storage.assets.iconChancellor);
		}
	
		if(s.getPreviousPresident() != null && s.getPreviousPresident().getID() == player.getID()) {
			addIcon(playerEl, storage.assets.iconPreviousPresident);
		}
	
		if(s.getPreviousChancellor() != null && s.getPreviousChancellor().getID() == player.getID()) {
			addIcon(playerEl, storage.assets.iconPreviousChancellor);
		}
	
		if(s.getBlockedPlayer() != null && s.getBlockedPlayer().getID() == player.getID()) {
			addIcon(playerEl, storage.assets.iconPlayerBlocked);
		}
	
		if(isDead) {
			addIcon(playerEl, storage.assets.iconDead);
		}
	
		if(isPlayerNotHitlerConfirmed(player.getID())) {
			addIcon(playerEl, storage.assets.iconNotHitler);
		}
	
		if(isPlayerNotStalinConfirmed(player.getID())) {
			addIcon(playerEl, storage.assets.iconNotStalin);
		}
	
		if(player.vote != null) {
			addIcon(playerEl, player.vote ? storage.assets.iconYes : storage.assets.iconNo);
		}
	
		if(player.wasRole != null) {
			addIcon(playerEl, storage.assets.iconRole[player.wasRole.name()]);
		}

		let ph = document.createElement("div");
		ph.classList.add("player-list-placeholder");
		playerEl.appendChild(ph);

		playerList.appendChild(playerEl);
	}
}

function addIcon(playerEl, icon) {
	let iconEl = icon.cloneNode();
	iconEl.classList.add("player-icon");
	playerEl.appendChild(iconEl);
}

function clearClickables() {
	let els;
	while((els = document.getElementsByClassName("clickable")).length != 0) {
		els[0].remove();
	}
}

function clearStateBoundObjects() {
	let els;
	while((els = document.getElementsByClassName("state-bound")).length != 0) {
		els[0].remove();
	}
}

function clearHoverables() {
	let els;
	while((els = document.getElementsByClassName("hoverable")).length != 0) {
		els[0].remove();
	}
}

function createButton(name, x, y, width, height, onclick, stateBound = false) {
	let btn = document.createElement("button");
	btn.textContent = name;
	btn.classList.add("clickable", "ingame-button");
	if(stateBound) btn.classList.add("state-bound");
	btn.style.position = "absolute";
	btn.style.left = (x / canvas.width * 100) + "%";
	btn.style.top = (y / canvas.height * 100) + "%";
	btn.style.width = (width / canvas.width * 100) + "%";
	btn.style.height = (height / canvas.height * 100) + "%";
	btn.style.fontSize = "1.5vw";
	btn.onclick = () => onclick(btn);
	gameContainer.appendChild(btn);
	return btn;
}

function createClickableArea(x, y, width, height, onclick, label = null, stateBound = false) {
	let area = document.createElement("div");
	if(label != null) area.title = label;
	area.classList.add("clickable");
	if(stateBound) area.classList.add("state-bound");
	area.style.position = "absolute";
	area.style.left = (x / canvas.width * 100) + "%";
	area.style.top = (y / canvas.height * 100) + "%";
	area.style.width = (width / canvas.width * 100) + "%";
	area.style.height = (height / canvas.height * 100) + "%";
	area.onclick = () => onclick(area);
	gameContainer.appendChild(area);
	return area;
}

function createHoverableArea(x, y, width, height, label, stateBound = false) {
	let area = document.createElement("div");
	if(label != null) area.title = label;
	area.classList.add("hoverable");
	if(stateBound) area.classList.add("state-bound");
	area.style.position = "absolute";
	area.style.left = (x / canvas.width * 100) + "%";
	area.style.top = (y / canvas.height * 100) + "%";
	area.style.width = (width / canvas.width * 100) + "%";
	area.style.height = (height / canvas.height * 100) + "%";
	gameContainer.appendChild(area);
	return area;
}

function loadImage(assetName) {
	let img = new Image();
	img.src = "assets/" + assetName;
	return img;
}

function drawImageWithWidth(img, x, y, w) {
	let h = w / img.width * img.height;
	ctx.drawImage(img, x, y, w, h);
}

function drawImageWithHeight(img, x, y, h) {
	let w = h / img.height * img.width;
	ctx.drawImage(img, x, y, w, h);
}

function drawImageWithBounds(img, x, y, w, h) {
	let imgAspectRatio = img.width / img.height;
	let aspectRatio = w / h;
	if(imgAspectRatio > aspectRatio) {
		drawImageWithWidth(img, x, y + (1 - (aspectRatio / imgAspectRatio)) * h / 2, w);
	}else {
		drawImageWithHeight(img, x + (1 - (imgAspectRatio / aspectRatio)) * w / 2, y, h);
	}
}

function removeFromArray(array, element) {
	if(array.indexOf(element) == -1) return;
	array.splice(array.indexOf(element), 1);
}

function getPlayer(playerID) {
	for(let p of storage.room.getPlayers()) {
		if(p.getID() == playerID) return p;
	}
	return null;
}

function isPlayerDead(playerID) {
	if(storage.room.getGameState() == null) return false;
	for(let p of storage.room.getGameState().getDeadPlayers()) {
		if(p.getID() == playerID) return true;
	}
	return false;
}

function isPlayerNotHitlerConfirmed(playerID) {
	for(let p of storage.room.getGameState().getNotHitlerConfirmed()) {
		if(p.getID() == playerID) return true;
	}
	return false;
}

function isPlayerNotStalinConfirmed(playerID) {
	for(let p of storage.room.getGameState().getNotStalinConfirmed()) {
		if(p.getID() == playerID) return true;
	}
	return false;
}

function isGamePaused() {
	return storage.room.isGamePaused();
}