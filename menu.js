var menus = {};

function setMenu(k, v) {
    if(k in menus) {
        menus[k].remove();
        delete menus[k];
    }
    menus[k] = v;
}

window.onclick = (e) => {
    for(const k of Object.keys(menus)) {
        const v = menus[k];
        if(v['nonRemovable']) continue;
        if(!v.contains(e.target)) {
            v.remove();
            delete menus[k];
        }
    }
}

function add_back_buttons_to_menu(menu) {
    menu.filter(v => v['type'] == 'menu').forEach(o => {
        add_back_buttons_to_menu(o['value']);
        o['value'].push({
            'type': 'menu',
            'label': "< Back",
            'subtype': 'menu_back_button',
            'value': menu
        });
    });
}

function create_menu_(menu) {
    const container = document.createElement("div");
    container.className = "menu_container";
    const types = ["range", "button", "checkbox", "menu"];
    
    const menu_new = [...menu];
    for(const e of menu_new) {
        let type = e['type'];
        if(!(types.includes(type))) continue;
        
        let label = e['label'];
        let func  = e['func' ];
        
        if(!label) label = "";
        if(!func ) func = () => {};
        
        if(type == "menu") {
            type = "button";
            let f = func;
            func = (l) => {
                f(label);
                container.replaceWith(create_menu_(e['value']));
            };
        }
        
        const s = document.createElement("span");
        s.className = "menu_span";
        
        switch(type) {
            case "button": {
                const t = document.createElement("button");
                t.className = "menu_button";
                t.innerHTML = label;
                t.onclick = () => {
                    if(e['exit']) container.remove();
                    func(label);
                }
                
                s.appendChild(t);
            } break;
            case "checkbox": {
                const l = document.createElement("text");
                l.className = "menu_text";
                l.innerHTML = label;
                const t = document.createElement("input");
                t.className = "menu_checkbox";
                t.type = "checkbox";
                t.checked = !!e['value'];
                t.onchange = () => func(label, t.checked);
                
                s.appendChild(l);
                s.appendChild(t);
            } break;
            case "range": {
                const c = document.createElement("div");
                c.className = "menu_range_div";
                
                const l = document.createElement("text");
                l.className = "menu_text";
                l.innerHTML = label;
                const t = document.createElement("input");
                t.className = "menu_range";
                t.type = "range";
                t.min = e['min'] || 0;
                t.max = e['max'] || 100;
                t.value = e['value'] || 50;
                t.onchange = (v) => func(label, t.value);
                
                c.appendChild(l);
                c.appendChild(t);
                
                s.appendChild(c);
            } break;
        }
        
        container.append(s);
    }
    return container;
}

function create_menu(menu) {
    add_back_buttons_to_menu(menu);
    return create_menu_(menu);
}

function create_floating_menu(e, menu) {
    const container = document.createElement("div");
    container.style['left'] = e.clientX - 5 + "px";
    container.style['top' ] = e.clientY - 5 + "px";
    container.className = "floating_menu_container";
    container.appendChild(create_menu(menu));
    document.body.appendChild(container)
    return container;
}

function floating_menu(name, e, menu) {
    setMenu(name, create_floating_menu(e, menu));
}

/* document.body.insertBefore(create_menu([
    {
        'type': 'button',
        'label': 'hi',
        'func': e => print(e)
    }, {
        'type': 'menu',
        'label': 'haha submenu',
        'value': [
            {
                'type': 'button',
                'label': 'xdddd',
                'func': e => print(e)
            },
            {
                'type': 'menu',
                'label': 'haha submenu TWO',
                'value': [
                    {
                        'type': 'button',
                        'label': 'AHHASDASDUHU',
                        'func': e => print(e)
                    },
                    
                ],
                'func': e => print(e)
            }
        ],
        'func': e => print(e)
    }, {
        'type': 'checkbox',
        'value': true,
        'label': 'hello',
        'func': (l, v) => print(l, v)
    }, {
        type: "range",
        label: "vol",
        min  : 0,
        max  : 100,
        value: 50,
        func : (l, v) => print(l, v)
    }
]), document.body.firstChild); */
/* function promptSelection(mapping, callback) {
    if(previousBaseElm = document.getElementById("popupSelectionBase")) previousBaseElm.remove();
    
    const base = document.createElement("div");
    base.setAttribute("id", "popupSelectionBase");
    base.className = "popupSelectorBase";
    const selector = document.createElement("select");
    selector.className = "popupSelector";
    base.appendChild(selector);
    
    const def = document.createElement("option");
    def.innerHTML = "Select...";
    def.hidden = true;
    def.disabled = true;
    def.selected = true;
    selector.appendChild(def);
    
    for(const key of Object.keys(mapping)) {
        const choice = document.createElement("option");
        choice.setAttribute("value", key);
        choice.innerHTML = key;
        selector.appendChild(choice);
    }
    base.onclick = () => {
        base.remove();
    }
    selector.onchange = () => {
        callback(mapping[selector.value]);
        base.remove();
    };
    document.body.appendChild(base);
} */