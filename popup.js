var thePopup = null;

class Popup {

	title = null
	text = null
	buttons = []
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

	addButton(text, action) {
		this.buttons.push({text: text, action: {dismiss: true, run: action}});
		return this;
	}

	addHideButton() {
		this.buttons.push({text: "Hide", action: {dismiss: false, run: () => this.hide()}});
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

		for(let btn of this.buttons) {
			let buttonEl = document.createElement("button");
			buttonEl.classList.add("popup-button");
			buttonEl.innerText = btn.text;
			buttonEl.onclick = () => {
				if(btn.action.dismiss) this.dismiss();
				if(btn.action.run != null) btn.action.run();
			};
			popup.appendChild(buttonEl);
		}

		popupC.appendChild(popup);
	}

	dismiss() {
		this.element.remove();
		thePopup = null;
	}

	hide() {
		this.element.style.display = "none";
	}

	unhide() {
		this.element.style.display = "block";
	}

}