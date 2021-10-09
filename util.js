class Util {

	static removeFromArray(array, element) {
		if(array.indexOf(element) == -1) return;
		array.splice(array.indexOf(element), 1);
	}

}