var thePopup = null;
var unhideButton = document.getElementById("popup-unhide-button");

class Popup {

	title = null
	text = null
	elements = []
	element = null

	constructor() {}

	static ofTitleAndText(title, text) {
		let p = new Popup();
		p.title = title;
		p.text = text;
		return p;
	}

	static ofText(text) {
		return Popup.ofTitleAndText(null, text);
	}

	addCardsView(cards, action, pickMode = false) {
		this.elements.push({type: "cards_view", pickMode: pickMode, cards: cards, action: action});
		return this;
	}

	addButton(text, action) {
		this.elements.push({type:"button", text: text, action: {dismiss: true, run: action}});
		return this;
	}

	addHideButton() {
		this.elements.push({type:"button", text: "Hide", action: {dismiss: false, run: () => this.hide()}});
		return this;
	}

	show() {
		if(thePopup != null) thePopup.dismiss();
		thePopup = this;

		let popupC = document.getElementById("popup-container");
		let popup = document.createElement("div");
		popup.classList.add("popup");
		this.element = popup;

		if(this.title != null) {
			let titleEl = document.createElement("p");
			titleEl.classList.add("popup-title");
			titleEl.innerText = this.title;
			popup.appendChild(titleEl);
		}

		if(this.text != null) {
			let textEl = document.createElement("p");
			textEl.classList.add("popup-text");
			textEl.innerText = this.text;
			popup.appendChild(textEl);
		}

		for(let el of this.elements) {
			if(el.type == "button") {
				let buttonEl = document.createElement("button");
				buttonEl.classList.add("popup-button");
				buttonEl.innerText = el.text;
				buttonEl.onclick = () => {
					if(el.action.dismiss) this.dismiss();
					if(el.action.run != null) el.action.run();
				};
				popup.appendChild(buttonEl);
			}else if(el.type == "cards_view") {
				console.log(el);
				let viewEl = document.createElement("div");
				viewEl.classList.add("popup-cards-view");

				let selected = [];
				for(let i = 0; i < el.cards.length; i++) {
					let card = el.cards[i];
					let cardEl = document.createElement("img");
					cardEl.src = "/assets/article/" + card.name().toLowerCase() + ".png";
					if(el.pickMode) cardEl.onclick = () => {
						let isSelected = selected.indexOf(i) != -1;
						if(isSelected) {
							Util.removeFromArray(selected, i);
							cardEl.src = "/assets/article/" + card.name().toLowerCase() + ".png";
						}else {
							selected.push(i);
							cardEl.src = "/assets/article/back.png";
						}
					};
					viewEl.appendChild(cardEl);
				}
				popup.appendChild(viewEl);

				let buttonEl = document.createElement("button");
				buttonEl.classList.add("popup-button");
				buttonEl.innerText = "Confirm";
				buttonEl.onclick = () => {
					this.dismiss();

					if(el.pickMode) {
						if(selected.length != 1) {
							Popup.ofTitleAndText("Error", "You need to select exactly 1 card to dismiss")
								.addButton("Okay", () => {
									this.show();
								})
								.show();
							return;
						}

						if(el.action != null) el.action(selected[0]);
					}else {
						if(el.action != null) el.action();
					}
				};
				popup.appendChild(buttonEl);
			}
		}

		popupC.appendChild(popup);
	}

	dismiss() {
		this.element.remove();
		thePopup = null;
	}

	hide() {
		this.element.style.display = "none";
		unhideButton.style.display = "block";
	}

	unhide() {
		this.element.style.display = "block";
	}

	static unhideCurrentPopup() {
		if(thePopup != null) thePopup.unhide();
		unhideButton.style.display = "none";
	}

}