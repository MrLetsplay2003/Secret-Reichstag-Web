function drawBoard(ctx, party, x, y, width, height) {
	let boardColors = storage.colors.board[party.name()];

	ctx.fillStyle = storage.colors.board.background;
	ctx.fillRect(x, y, width, height);

	let borderWidth = height / 35;
	ctx.fillStyle = boardColors.outerFill;
	ctx.fillRect(x + borderWidth, y + borderWidth, width - 2 * borderWidth, height - 2 * borderWidth);

	let cardCount = party == GameParty.LIBERAL ? 5 : 6;
	let cardHeight = height * 3 / 5;
	let cardWidth = cardHeight / 1.45;

	let cardSpacing = width / 50;

	let singleCardSpace = (cardWidth + cardSpacing);
	let totalCardSpace = singleCardSpace * cardCount - cardSpacing;

	let board;
	switch(party) {
		case GameParty.LIBERAL:
			board = storage.room.getGameState().getLiberalBoard();
			break;
		case GameParty.FASCIST:
			board = storage.room.getGameState().getFascistBoard();
			break;
		case GameParty.COMMUNIST:
			board = storage.room.getGameState().getCommunistBoard();
			break;
	}

	if(party != GameParty.LIBERAL) {
		// Draw "unsafe" cards boundary
		let unsafeCards = 3;
		let cX = width / 2 - totalCardSpace / 2 + singleCardSpace * unsafeCards;
		let cY = height / 2 - cardHeight / 2;
		let unsafeWidth = singleCardSpace * unsafeCards - cardSpacing;
		ctx.fillStyle = boardColors.unsafeFill;
		ctx.fillRect(x + cX - borderWidth, y + cY - borderWidth, unsafeWidth + 2 * borderWidth, cardHeight + 2 * borderWidth);

		// "Unsafe" text
		ctx.fillStyle = storage.colors.board.infoText;
		ctx.font = "normal bold " + height / 16 + "px Germania One";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText(party.getFriendlyName() + " win if " + party.getLeaderName() + " is elected Chancellor", x + cX + unsafeWidth / 2, y + height * 9 / 10);
	}else {
		// Draw election tracker
		let numPoints = 4;
		let size = width / 50;
		let spacing = 5 * size;
		let pY = 9 / 10 * height;

		for(let i = 0; i < numPoints; i++) {
			let pX = width / 2 - (spacing * numPoints) / 2 + i * spacing + spacing / 2;

			ctx.fillStyle = storage.room.getGameState().getFailedElections() == i ? boardColors.electionTrackerActive : boardColors.electionTrackerInactive;
			ctx.beginPath();
			ctx.arc(x + pX, y + pY, size, 0, 2 * Math.PI);
			ctx.fill();
		}
	}

	for(let cardIdx = 0; cardIdx < cardCount; cardIdx++) {
		let cX = width / 2 - totalCardSpace / 2 + singleCardSpace * cardIdx;
		let cY = height / 2 - cardHeight / 2;

		ctx.fillStyle = boardColors.cardBackground;
		ctx.fillRect(x + cX, y + cY, cardWidth, cardHeight);

		// Action fields
		for(let af of board.getActionFields()) {
			if(af.getFieldIndex() != cardIdx) continue;

			drawImageWithBounds(storage.assets.actions[af.getAction().name()][party.name()], x + cX, y + cY, cardWidth, cardHeight);
			break;
		}

		// Cards
		if(board.getNumCards() > cardIdx) {
			drawImageWithBounds(storage.assets.article[party.name()], x + cX, y + cY, cardWidth, cardHeight);
		}

		// Win icon
		if(cardIdx == cardCount - 1) {
			let winIcon = storage.assets.iconWin[party.name()];
			if(winIcon != null) drawImageWithBounds(winIcon, x + cX, y + cY, cardWidth, cardHeight);
		}

		// Veto text
		if(party != GameParty.LIBERAL && cardIdx == cardCount - 2) {
			ctx.fillStyle = storage.colors.board.infoText;
			ctx.font = "normal bold " + height / 16 + "px Germania One";
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.fillText("+ Veto", x + cX + cardWidth / 2, y + cY + cardHeight - height / 16);
		}
	}

	// Title
	ctx.fillStyle = boardColors.title;
	ctx.font = "normal bold " + height / 8 + "px Germania One";
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillText(party.getFriendlyNameSingular(), x + width / 2, y + height * 1 / 10 + borderWidth / 2);
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