(function () {
    // Absolute path location of this JS file
    const scriptSrc = document.currentScript.src;

    class MultiCombobox extends HTMLElement {
        static get observedAttributes() {
            return ["open", "required", "placeholder", "multiple", "tags", "autocomplete"];
        }
        static formAssociated = true;

        #shadow;
        #internals;

        constructor() {
            super();
            this.els = {
                tagsContainer: null,
                combobox: null,
                searchInput: null,
                listbox: null,
            };
            this.value = "";
            this.tags = new Map();
            this.listeners = new Map();

            this.optionsData = [];
            this.currentOption = null;
            this.allOptions = new Map();
            this.selectedOptions = new Map();
            this.visibleOptions = [];

            this.focusOnListbox = false;

            this.props = {
                multiple: false,
                tags: false,
                autocomplete: false,
                required: false,
            };

            this.#shadow = this.attachShadow({
                mode: "open",
                clonable: true,
                delegatesFocus: true,
            });
            this.#internals = this.attachInternals();
        }

        async connectedCallback() {
            await this.loadCSS();

            if (this.props.tags && !this.props.multiple) {
                throw new Error("MultiCombobox: tags only work with multiple='true'");
            }

            /* Retrieve or create the shadow DOM's content. */
            if (this.props.tags) {
                this.els.tagsContainer =
                    this.#shadow.querySelector(".tags-container") ||
                    this.createElement("div", { classList: "tags-container" }, this.#shadow);
            }
            this.els.combobox =
                this.#shadow.querySelector(".combobox-container") ||
                this.createElement("div", { classList: "combobox-container" }, this.#shadow);
            this.els.searchInput =
                this.#shadow.querySelector(".searchbox") ||
                this.createElement(
                    "input",
                    {
                        classList: "searchbox",
                        type: "text",
                        role: "combobox",
                        "aria-autocomplete": this.props.autocomplete,
                        "aria-expanded": "false",
                        "aria-controls": "listbox",
                        placeholder: this.hasAttribute("placeholder") && this.placeholder,
                    },
                    this.els.combobox
                );
            this.els.searchInput.disabled = this.isDisabled;
            if (this.hasAttribute("autofocus")) {
                this.focus();
            }
            this.els.deleteButton =
                this.#shadow.querySelector(".delete-value") ||
                this.createElement(
                    "button",
                    {
                        classList: "delete-value",
                    },
                    this.els.combobox
                );
            this.els.deleteButton.textContent = "×";

            this.els.listbox =
                this.#shadow.querySelector(".listbox") ||
                this.createElement(
                    "ul",
                    {
                        classList: "listbox",
                        id: "listbox",
                        role: "listbox",
                    },
                    this.els.combobox
                );

            /* Initialize form validation */
            this.setRequiredValidity();

            // The MultiCombobox' light DOM children may be parsed later, so we observe them.
            // This also allows to append new children later.
            const observer = new MutationObserver(this.onMutation);
            observer.observe(this, { childList: true, subtree: true });

            this.generateOptions(this.querySelectorAll("li"));

            // Override the delegateFocus' target to be sure to focus the input.
            this.listeners.set(this, { click: this.focus.bind(this) });

            this.listeners.set(this.els.searchInput, {
                keydown: this.onSearchKeydown,
                input: this.onSearchInput,
                click: this.onSearchClick,
                pointerup: this.onPointerup,
            });
            this.listeners.set(this.els.deleteButton, {
                click: this.onDeleteButtonClick,
            });
            this.listeners.set(document.body, {
                pointerup: this.onPointerup,
            });

            for (const element of [
                this,
                this.els.searchInput,
                this.els.deleteButton,
                document.body,
            ]) {
                this.addListeners(element);
            }
        }

        disconnectedCallback() {
            for (const element of this.listeners.keys()) {
                this.removeListeners(element);
            }

            this.allOptions.forEach((option) => option.remove());
            this.emptyVisibleOptions();

            this.value = "";
            this.listeners.clear();
            this.currentOption = null;
            this.allOptions.clear();
            this.selectedOptions.clear();
            this.focusOnListbox = false;
        }

        attributeChangedCallback(name, oldValue, newValue) {
            const updateBooleanProp = () => {
                this.props[name] = ["true", "", name].includes(newValue);
            };
            switch (name) {
                case "open":
                    this.toggleListbox(!!newValue);
                    break;
                case "multiple":
                case "tags":
                    updateBooleanProp();
                    break;
                case "required":
                    updateBooleanProp();
                    if (this.els.searchInput) {
                        this.setRequiredValidity();
                    }
                    break;
                case "autocomplete":
                    this.props.autocomplete = this.hasAttribute("autocomplete")
                        ? this.getAttribute("autocomplete")
                        : "false";
                    break;
                case "placeholder":
                    this.els.searchInput?.setAttribute("placeholder", newValue);
                    break;
                default:
                    break;
            }
        }

        async loadCSS() {
            if (!this.#shadow.adoptedStyleSheets.length) {
                const stylesheet = new CSSStyleSheet();
                const cssURL = new URL(scriptSrc);
                cssURL.pathname = cssURL.pathname.replace(/js$/, "css");
                const response = await fetch(cssURL);
                const styles = await response.text();
                stylesheet.replaceSync(styles);
                this.#shadow.adoptedStyleSheets = [stylesheet];
            }
        }

        // ==============================================================================
        // ============================ FORM COMPATIBILITY ==============================
        // ==============================================================================

        /**
         * @param {Boolean} disabled
         */
        formDisabledCallback(disabled) {
            if (this.els.searchInput) {
                this.els.searchInput.disabled = this.isDisabled;
            }
            this.els.tagsContainer
                ?.querySelectorAll("button")
                .forEach((button) => (button.disabled = this.isDisabled));
        }

        get isDisabled() {
            return this.disabled || this.matches(":disabled");
        }

        /**
         * @param {ValidityStateFlags} flags
         * @param {string} message
         * @param {HTMLElement} anchor
         */
        #setValidity(flags, message, anchor) {
            this.#internals.setValidity(flags, message, anchor);
        }

        setRequiredValidity() {
            this.#setValidity(
                { valueMissing: this.props.required && !this.selectedOptions.size },
                "A value is required",
                this.els.searchInput
            );
        }

        checkValidity() {
            return this.#internals.checkValidity();
        }

        reportValidity() {
            return this.#internals.reportValidity();
        }

        get validity() {
            return this.#internals.validity;
        }

        get validationMessage() {
            return this.#internals.validationMessage;
        }

        get formValue() {
            let formValue = new FormData();
            for (const selectedOption of this.selectedOptions.values()) {
                formValue.append(this.getAttribute("name"), selectedOption.id);
            }
            return formValue;
        }

        // ==============================================================================
        // ============================= GETTERS / SETTERS ==============================
        // ==============================================================================

        /* ATTRIBUTES */

        get open() {
            return this.hasAttribute("open");
        }

        set open(value) {
            if (!!value) {
                this.setAttribute("open", "true");
            } else {
                this.removeAttribute("open");
            }
        }

        get placeholder() {
            return this.getAttribute("placeholder");
        }

        set placeholder(value) {
            this.setAttribute("placeholder", value);
        }

        get autofocus() {
            return this.hasAttribute("autofocus");
        }

        set autofocus(value) {
            if (!value) {
                this.removeAttribute("autofocus");
            } else {
                this.setAttribute("autofocus", "");
            }
        }

        /* INPUT */

        get inputValue() {
            return this.els.searchInput.value;
        }
        set inputValue(value) {
            this.els.searchInput.value = value;
            this.toggleDeleteButton(!this.inputValue);
        }

        /* OPTIONS */

        get hasVisibleOptions() {
            return !!this.visibleOptions.length;
        }

        get firstVisibleOption() {
            return this.visibleOptions[0];
        }

        get lastVisibleOption() {
            return this.visibleOptions[this.visibleOptions.length - 1];
        }

        get nextVisibleOption() {
            if (!this.currentOption || this.currentOption === this.lastVisibleOption) {
                return this.firstVisibleOption;
            } else {
                const currentIndex = this.visibleOptions.findIndex(
                    (el) => el === this.currentOption
                );
                return this.visibleOptions[currentIndex + 1];
            }
        }

        get previousVisibleOption() {
            if (!this.currentOption || this.currentOption === this.firstVisibleOption) {
                return this.lastVisibleOption;
            } else {
                const currentIndex = this.visibleOptions.findIndex(
                    (el) => el === this.currentOption
                );
                return this.visibleOptions[currentIndex - 1];
            }
        }

        /**
         * @param {HTMLElement} option
         */
        set visibleOption(option) {
            option.classList.remove("hidden");
            this.visibleOptions.push(option);
        }

        // ==============================================================================
        // ================================ UTILS =======================================
        // ==============================================================================

        /**
         * @param {string} tagName
         * @param {Object} attrs
         * @param {HTMLElement} parentNode
         * @returns {HTMLElement}
         */
        createElement(tagName, attrs, parentNode) {
            if (arguments.length === 2) {
                parentNode = attrs;
                attrs = [];
            }
            const el = document.createElement(tagName);
            for (const attr in attrs) {
                if (attr === "classList") {
                    if (attrs[attr] instanceof Array) {
                        el.classList.add(...attrs[attr]);
                    } else {
                        el.classList.add(attrs[attr]);
                    }
                } else if (![false, undefined, null].includes(attrs[attr])) {
                    el.setAttribute(attr, attrs[attr]);
                }
            }
            parentNode.appendChild(el);
            return el;
        }

        /**
         * @param {HTMLElement} element
         */
        addListeners(element) {
            for (const event in this.listeners.get(element)) {
                element.addEventListener(event, this.listeners.get(element)[event]);
            }
        }

        /**
         * @param {HTMLElement} element
         */
        removeListeners(element) {
            for (const event in this.listeners.get(element)) {
                element.removeEventListener(event, this.listeners.get(element)[event]);
            }
        }

        /**
         * @param {string} str
         * @returns {Boolean}
         */
        isPrintableCharacter(str) {
            return str.length === 1 && str.match(/\S| /);
        }

        /**
         * @param {string} str
         * @returns {string}
         */
        normalizeString(str) {
            return str
                .toLowerCase()
                .trim()
                .normalize("NFKD")
                .replace(/\p{Diacritic}|œ|æ/gu, (match) => {
                    switch (match) {
                        case "œ":
                            return "oe";
                        case "æ":
                            return "ae";
                        default:
                            return "";
                    }
                });
        }

        // ==============================================================================
        // ============================= FUNCTIONAL =====================================
        // ==============================================================================

        /* FOCUS */

        focus() {
            this.els.searchInput.focus();
            this.setFocusCombobox();
        }

        setFocusCombobox() {
            this.els.searchInput.removeAttribute("aria-activedescendant");
            this.focusOnListbox = false;
        }

        setFocusListbox() {
            this.currentOption.scrollIntoView({
                behavior: this.focusOnListbox ? "smooth" : "instant",
                block: "nearest",
            });
            this.els.searchInput.setAttribute("aria-activedescendant", this.currentOption.id);
            this.focusOnListbox = true;
        }

        /* DELETE BUTTON */

        toggleDeleteButton(force) {
            this.els.deleteButton.classList.toggle("hidden", force);
        }

        /* OPTIONS */

        /**
         * @param {NodeList|HTMLElement[]} elements
         */
        generateOptions(elements) {
            elements.forEach((li) => {
                if (li.tagName !== "LI") {
                    console.error("MultiCombobox: options should use element <li>");
                    li.remove();
                    return;
                }
                if (!li.dataset.id) {
                    console.error(
                        "MultiCombobox: multi-combobox children must have a data-id attribute"
                    );
                    li.remove();
                    return;
                }
                if (this.selectedAlreadySet && li.getAttribute("selected")) {
                    console.error(
                        "MultiCombobox: multi-combobox without multiple='true' cannot have more than one default selected option"
                    );
                }
                const info = {
                    id: li.dataset.id,
                    value: li.textContent,
                    selected: this.selectedAlreadySet ? false : li.hasAttribute("selected"),
                };
                if (info.selected && !this.selectedAlreadySet) {
                    if (!this.props.multiple) {
                        this.selectedAlreadySet = true;
                    }
                }
                const duplicate = this.optionsData.find((item) => item.id === info.id);
                if (duplicate) {
                    console.error(
                        `MultiCombobox: id ${info.id} is set more than once (for ${duplicate.value} and ${info.value}). '${info.value}' was discarded.`
                    );
                    return;
                }
                this.optionsData.push(info);

                this.registerOption(info);
            });
        }

        /**
         * @param {Object} data
         */
        registerOption(data) {
            const multi = this.props.multiple;
            const option = this.createElement(
                "li",
                {
                    classList: "option",
                    role: multi ? "checkbox" : "option",
                    id: data.id,
                    [multi ? "aria-checked" : "aria-selected"]: data.selected,
                },
                this.els.listbox
            );
            if (data.selected) {
                if (!multi) {
                    this.value = data.value;
                    this.inputValue = data.value;
                    this.currentOption = option;
                }
                this.updateSelectedOptions(option);
            }
            option.textContent = data.value;

            this.allOptions.set(data.id, option);
            this.visibleOption = option;

            this.listeners.set(option, {
                click: this.onOptionClick,
                pointerup: this.onPointerup,
            });
            this.addListeners(option);

            this.setTag(data.value, data.id, data.selected);
        }

        emptyVisibleOptions() {
            this.visibleOptions = [];
        }

        resetVisibleOptions() {
            this.emptyVisibleOptions();
            this.optionsData.forEach((item) => {
                const option = this.allOptions.get(item.id);
                this.visibleOption = option;
            });
        }

        /**
         * @param {Boolean} [noFilter] - if true, resets the visible options
         */
        filterOptions(noFilter) {
            if (noFilter) {
                this.resetVisibleOptions();
                return;
            }

            if (this.props.autocomplete === "list") {
                this.emptyVisibleOptions();
            }
            for (const item of this.optionsData) {
                const option = this.allOptions.get(item.id);
                const hasNeedle = this.normalizeString(item.value).includes(
                    this.normalizeString(this.inputValue)
                );
                if (this.props.autocomplete === "list") {
                    option.classList.toggle("hidden", !hasNeedle);
                    if (hasNeedle) {
                        this.visibleOption = option;
                    }
                } else if (hasNeedle) {
                    this.changeCurrentOption(option);
                    break;
                }
            }
        }

        /**
         * @param {HTMLElement} option
         */
        changeCurrentOption(option) {
            if (this.props.multiple) {
                this.currentOption?.removeAttribute("aria-current");
                this.currentOption = option;
            } else {
                this.currentOption?.removeAttribute("aria-selected");
                if (option) {
                    this.currentOption = option;
                } else {
                    this.selectedOption?.setAttribute("aria-selected", "true");
                    this.currentOption = this.selectedOption;
                }
            }
            if (option) {
                option.setAttribute(this.props.multiple ? "aria-current" : "aria-selected", "true");
                this.setFocusListbox();
            } else {
                this.setFocusCombobox();
            }
        }

        /**
         * @param {HTMLElement} option
         */
        updateSelectedOptions(option) {
            if (!option) {
                this.selectedOptions.clear();
                this.selectedOption = null;
            } else if (!this.selectedOptions.has(option.id)) {
                if (!this.props.multiple) {
                    this.selectedOptions.clear();
                    this.selectedOption = option;
                }
                this.selectedOptions.set(option.id, option);
            } else {
                this.selectedOptions.delete(option.id);
                this.selectedOption = null;
            }
            this.setRequiredValidity();
            this.#internals.setFormValue(this.formValue);
        }

        /**
         * @param {HTMLElement} option
         */
        validateOption(option) {
            const value = option.textContent;
            const optionData = this.optionsData.find((item) => item.value === value);
            if (this.props.multiple) {
                option.ariaChecked = !JSON.parse(option.ariaChecked);
                optionData.selected = !optionData.selected;
                this.updateSelectedOptions(option);
            } else {
                this.value = value;
                this.updateSelectedOptions(option);
                this.open = false;
            }
            this.setTag(optionData.value, optionData.id);
        }

        deleteValue() {
            this.value = "";
            this.inputValue = "";
            this.resetVisibleOptions();
            if (!this.props.multiple) {
                this.updateSelectedOptions();
            }
            this.changeCurrentOption(null);
        }

        /* LISTBOX */

        /**
         * @param {Boolean} [force] - true to open, false to close
         */
        toggleListbox(force) {
            switch (force) {
                case true:
                    if (this.hasVisibleOptions) {
                        const searchRect = this.els.searchInput.getBoundingClientRect();
                        const openAbove =
                            window.innerHeight - searchRect.bottom <
                            parseInt(getComputedStyle(this.els.listbox).height);
                        this.els.listbox.classList.toggle("top", openAbove);
                        if (openAbove) {
                            this.els.listbox.style.bottom = searchRect.height + "px";
                            this.els.listbox.style.top = "";
                        } else {
                            this.els.listbox.style.top = searchRect.height + "px";
                            this.els.listbox.style.bottom = "";
                        }
                        this.els.searchInput.ariaExpanded = "true";
                    }
                    break;
                case false:
                    this.els.searchInput.ariaExpanded = "false";
                    this.changeCurrentOption(null);
                    this.inputValue = this.value;
                    break;
                default:
                    this.toggleListbox(!this.open);
            }
        }

        /* TAGS */

        /**
         * @param {string} value - this.tags identifier
         * @param {string} key - option id
         */
        addTag(value, key) {
            const tag = this.createElement("span", { classList: "tag" }, this.els.tagsContainer);
            tag.textContent = value;
            const tagBtn = this.createElement("button", tag);
            tagBtn.disabled = this.isDisabled;
            tagBtn.dataset.key = key;
            this.listeners.set(tagBtn, {
                click: this.onTagButtonClick,
            });
            this.addListeners(tagBtn);
            this.tags.set(value, tag);
        }

        /**
         * @param {string} value - this.tags identifier
         */
        removeTag(value) {
            const tag = this.tags.get(value);
            const tagBtn = tag.firstElementChild;
            tag.remove();
            this.tags.delete(value);
            this.removeListeners(tagBtn);
            this.listeners.delete(tagBtn);
        }

        /**
         * @param {string} value  - this.tags identifier
         * @param {string} [key] - option id
         * @param {Boolean} [force] - true to add, false to delete
         */
        setTag(value, key, force) {
            if (!this.props.tags) {
                return;
            }

            switch (force) {
                case true:
                    if (!this.tags.has(value)) {
                        this.addTag(value, key);
                    }
                    break;
                case false:
                    if (this.tags.has(value)) {
                        this.removeTag(value);
                    }
                    break;
                default:
                    if (this.tags.has(value)) {
                        this.removeTag(value);
                    } else {
                        this.addTag(value, key);
                    }
            }
        }

        // ==============================================================================
        // ============================= HANDLERS =======================================
        // ==============================================================================

        /**
         * @param {MutationRecord[]} mutations
         */
        onMutation = (mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.target.tagName === "UL" && mutation.addedNodes.length) {
                    const elements = [...mutation.addedNodes].filter((el) => el.nodeType === 1);
                    this.generateOptions(elements);
                }
            });
        };

        /**
         * @param {PointerEvent} ev
         */
        onOptionClick = (ev) => {
            this.changeCurrentOption(ev.currentTarget);
            this.inputValue = this.currentOption.textContent;
            this.validateOption(ev.currentTarget);
            this.els.searchInput.focus();
        };

        /**
         * @param {KeyboardEvent} ev
         */
        onSearchKeydown = (ev) => {
            if (ev.ctrlKey) {
                return;
            }

            switch (ev.key) {
                case "Escape":
                    if (!this.open) {
                        this.deleteValue();
                    }
                    this.open = false;
                    break;
                case "Tab":
                    this.open = false;
                    this.focusOnListbox = false;
                    break;
                case "ArrowDown":
                    ev.preventDefault();
                    if (!this.open) {
                        this.filterOptions(this.props.autocomplete === "list");
                    }
                    if (this.hasVisibleOptions) {
                        this.open = true;
                        this.changeCurrentOption(this.nextVisibleOption);
                        this.inputValue = this.currentOption.textContent;
                    }
                    break;
                case "ArrowUp":
                    ev.preventDefault();
                    if (!this.open) {
                        this.filterOptions(this.props.autocomplete === "list");
                    }
                    if (this.hasVisibleOptions) {
                        this.open = true;
                        this.changeCurrentOption(this.previousVisibleOption);
                        this.inputValue = this.currentOption.textContent;
                    }
                    break;
                case "Enter":
                    if (!this.open) {
                        this.open = true;
                        this.filterOptions();
                    }
                    if (this.currentOption) {
                        this.validateOption(this.currentOption);
                    } else {
                        const item = this.optionsData.find(
                            (item) =>
                                this.normalizeString(item.value) ===
                                this.normalizeString(this.inputValue)
                        );
                        if (item) {
                            this.validateOption(this.allOptions.get(item.id));
                        }
                    }
                    break;
                case "ArrowLeft":
                case "ArrowRight":
                case "Home":
                case "End":
                case "Backspace":
                    this.setFocusCombobox();
                    break;
                default:
                    if (this.isPrintableCharacter(ev.key)) {
                        this.setFocusCombobox();
                    }
                    break;
            }
        };

        onSearchInput = () => {
            this.value = this.inputValue;
            this.filterOptions();
            this.open = this.hasVisibleOptions;
            if (this.currentOption && !this.visibleOptions.includes(this.currentOption)) {
                this.changeCurrentOption(null);
            }
            this.toggleDeleteButton(!this.inputValue);
        };

        onSearchClick = () => {
            this.open = !this.open;
        };

        /**
         * @param {PointerEvent} ev
         */
        onPointerup = (ev) => {
            if (this.els.combobox.contains(ev.target)) {
                ev.stopImmediatePropagation();
                return;
            }
            this.open = false;
        };

        /**
         * @param {PointerEvent} ev
         */
        onTagButtonClick = (ev) => {
            this.validateOption(this.allOptions.get(ev.currentTarget.dataset.key));
        };

        onDeleteButtonClick = () => {
            this.deleteValue();
        };
    }

    customElements.define("multi-combobox", MultiCombobox);
})();
