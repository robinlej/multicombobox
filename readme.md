# \<multi-combobox\> Web Component

## Features

-   **Selecting values**
    -   _multiple values_ (checkboxes): allow to select more than one value in the listbox.
        -   This comes with a built-in **tags** system, which must be activated through an attribute.
    -   _single values_ (options): classic combobox with one value selected at a time.
    -   Events on each implementation may differ, based on what _feels_ better:
        -   with single values, _Enter_ closes the listbox, applies the validated option to the search's value and further key events (_ArrowDown_, _ArrowUp_) will filter results based on the value.
        -   To the contrary, with multiple values, _Enter_ doesn't close the listbox and doesn't filter results based on the validated option.
-   **Autocomplete**:
    -   _list_: show only the options that match the current input value. With single values, it is only triggered after an input event (meaning that if you press the down arrow with a preselected option, you will see the whole list).
    -   _none_: show all the options, regardless of the current search. Autoselects the first match.
-   **Pre-selected options**: options can either be pre-checked (multi values) or pre-selected (single values).
-   **Values are normalized before comparison**: comparison is done on lowercase and ligatures or diacritics are removed to process comparisons. e.g.: "Ǉáèçö œ" will match "ljaeco oe".
-   **Built-in accessibility**: I made sure to follow [ARIA APG's combobox patterns](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/). If you think some things are missing or badly implemented, please let me know.
-   **Built-in form compatibility**: `<multi-combobox>` is made as a form-associated custom element.
    -   `required` attribute available
    -   selected options are returned in `FormData`
    -   clicking on a label will focus the search input

## Syntax

### Multi values

```html
<multi-combobox autocomplete="list|false" multi="true" tags="true">
    <ul>
        <li data-id="1" selected></li>
        <li data-id="2" selected></li>
        <li data-id="3"></li>
    </ul>
</multi-combobox>
```

### Single value

```html
<multi-combobox autocomplete="list|false">
    <ul>
        <li data-id="1" selected="true"></li>
        <li data-id="2"></li>
        <li data-id="3"></li>
    </ul>
</multi-combobox>
```

Note: the `<ul>` is mandatory.
`<li>` elements will be used to create the actual options. They can be injected after the combobox' initialization.

### Combobox Attributes

| Attribute      | Default   | Possible values                    | Info                                                                  |
| -------------- | --------- | ---------------------------------- | --------------------------------------------------------------------- |
| `autocomplete` | `"false"` | `"list"` \| `"false"`              |                                                                       |
| `multi`        | `false`   | `"true"` (or nothing)              | Any other value will default to `"true"`                              |
| `tags`         | `false`   | `"true"` (or nothing)              | Any other value will default to `"true"`. Not usable without `multi`. |
| `required`     | not set   | `"true"` (or nothing)              | At least one option must be selected for the form to be valid.        |
| `placeholder`  | not set   | any                                |                                                                       |
| `autofocus`    | `false`   | `""` \| `"autofocus"` (or nothing) | Like regular inputs, updating the attribute after page load will not change the behavior. Note that, like regular inputs, while `""` is an accepted value for the attribute, `this.autofocus` takes a truthy value to be active.         |

### Options Attributes

| Attribute  | Default | Possible values | Info                                                                                                                                                                                                                             |
| ---------- | ------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data-id`  |         | any             | Mandatory (each one must be different)                                                                                                                                                                                           |
| `selected` | `false` | `"true"`        | If `multi="true"`, you can pre-select as many values as you want. If `multi="false"` (or not set), you can pre-select only one value. In that case, if there are other selected values, only the first one will be used as such. |

## Customize the CSS

To customize the CSS, define the custom properties on the \<multi-combobox\> element.

| Variable                            | Default                                                             | Description                                             |
| ----------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------- |
| `--combobox-width`                  | `200px`                                                             | Used for the input and the listbox                      |
| `--combobox-border-color`           | `darkgrey`                                                          | Used for the input and the listbox                      |
| `--combobox-gap`                    | `0.3rem`                                                            | Gap between the input and the listbox when it's open    |
| `--input-border-radius`             | `5px`                                                               | Border radius for the input                             |
| `--input-padding`                   | `0.5rem 1rem`                                                       | Padding for the input                                   |
| `--listbox-background`              | `white`                                                             | Background of the listbox                               |
| `--option-padding`                  | `0.5rem 1rem`                                                       | Padding of each option                                  |
| `--highlight-background`            | `#f2f3ff`                                                           | Background color when hovering / focus set on an option |
| `--highlight-outline-color`         | `hsl(from var(--highlight-background) h calc(s + 40) calc(l - 20))` | Outline when hovering / focus set on an option          |
| `--highlight-outline-color-checked` | `hsl(from var(--highlight-background) h calc(s - 20) l)`            | Outline when hovering / focusing a checked option       |
| `--checked-background`              | `rgb(58, 57, 57)`                                                   | Background color of a checked or selected option        |
| `--checked-color`                   | `white`                                                             | Text color of a checked or selected option              |
| `--tag-background`                  | `#fff2f2`                                                           | Background color of a tag                               |
| `--tag-color`                       | `#302e2e`                                                           | Text color of a tag                                     |
| `--tag-border-radius`               | `999px`                                                             | Border radius of a tag                                  |
| `--tag-border-color`                | `hsl(from var(--tag-background) h calc(s + 20) calc(l - 15))`       | Border color of a tag                                   |
| `--tag-font-size`                   | `0.8rem`                                                            | Font size of a tag                                      |
| `--tag-font-family`                 | /                                                                   | Font family a a tag                                     |
| `--tag-gap`                         | `0.5rem`                                                            | Gap between each tag                                    |

## Notes

If you use it, note that the CSS file should be placed in the same folder as the JS file. (If you don't want that, you will have to update the `loadCSS()` method.)
