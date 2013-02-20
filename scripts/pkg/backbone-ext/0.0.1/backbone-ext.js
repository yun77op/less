(function() {

    // shorthands
    var slice = Array.prototype.slice;

    // Helper function to get a value from a Backbone object as a property
    // or as a function.
    var getValue = function(object, prop) {
        if (!(object && object[prop])) return null;
        return _.isFunction(object[prop]) ? object[prop]() : object[prop];
    };


    /**
     * A data structure which is a combination of an array and a set. Adding a new
     * member is O(1), testing for membership is O(1), and finding the index of an
     * element is O(1). Removing elements from the set is not supported. Only
     * strings are supported for membership.
     */
    function ArraySet() {
        this._array = [];
        this._set = {};
    }

    /**
     * Static method for creating ArraySet instances from an existing array.
     */
    ArraySet.fromArray = function ArraySet_fromArray(aArray) {
        var set = new ArraySet();
        for (var i = 0, len = aArray.length; i < len; i++) {
            set.add(aArray[i]);
        }
        return set;
    };

    /**
     * Add the given string to this set.
     *
     * @param {String} str
     * @param {*} [obj]
     */
    ArraySet.prototype.add = function ArraySet_add(str, obj) {
        if (this.has(str)) {
            // Already a member; nothing to do.
            return;
        }
        if (!obj) obj = str;
        var idx = this._array.length;
        this._array.push(obj);
        this._set[str] = idx;
    };

    ArraySet.prototype.forEach = function ArraySet_each(callback, thisArg) {
        this._array.forEach(callback, thisArg);
    };

    ArraySet.prototype.remove = function ArraySet_remove(str) {
      if (!this.has(str)) return;

      var idx = this._set[str];
      delete this._set[str];
      this._array.splice(idx, 1);
    };

    // Proxy to _'s chain
    ArraySet.prototype.chain = function ArraySet_chain() {
        return _(this._array).chain();
    };


    var undersocreMethods = ['filter'];

    undersocreMethods.forEach(function(method) {
        ArraySet.prototype[method] = function() {
            args = slice.call(arguments);
            args.unshift(this._array);
            return _[method].apply(_, args);
        }
    });

    /**
     * Is the given string a member of this set?
     *
     * @param String str
     */
    ArraySet.prototype.has = function ArraySet_has(aStr) {
        return Object.prototype.hasOwnProperty.call(this._set, aStr);
    };

    /**
     * What is the index of the given string in the array?
     *
     * @param {String} str
     */
    ArraySet.prototype.indexOf = function ArraySet_indexOf(aStr) {
        if (this.has(aStr)) {
            return this._set[aStr];
        }
		return null;
        //throw new Error('"' + aStr + '" is not in the set.');
    };

    ArraySet.prototype.get = function ArraySet_get(str) {
       return this.at(this.indexOf(str));
    };

    /**
     * What is the element at the given index?
     *
     * @param Number idx
     */
    ArraySet.prototype.at = function ArraySet_at(aIdx) {
        if (aIdx >= 0 && aIdx < this._array.length) {
            return this._array[aIdx];
        }
		return null;
        //throw new Error('No element indexed by ' + aIdx);
    };

    /**
     * Returns the array representation of this set (which has the proper indices
     * indicated by indexOf). Note that this is a copy of the internal array used
     * for storing the members so that no one can mess with internal state.
     */
    ArraySet.prototype.toArray = function ArraySet_toArray() {
        return this._array.slice();
    };



    // RouteManager

    var RouteManager = function() {
        this.router = new Backbone.Router();
        this.viewStates = {};
    };

    RouteManager.prototype = {
        constructor: RouteManager,

        _getInstance: function(ViewState) {
            var name = ViewState.prototype.name;
            return this.viewStates[name] || (this.viewStates[name] = new ViewState());
        },

        _handleRoute: function(targetViewState) {
            var previousViewState = this.activeViewState
              , args = slice.call(arguments).slice(1)
              , viewState;

            this.activeViewState = targetViewState;

            if (previousViewState) {
              if (targetViewState.isSibling(previousViewState) ||
                  previousViewState.isParentOf(targetViewState) ||
                  targetViewState.isParentOf(previousViewState) &&
                  this._isValidParent(args)) {
                previousViewState.transition();

                if (!previousViewState.isParentOf(targetViewState)) {
                  targetViewState.beforeEnter.apply(targetViewState, args);
                  targetViewState.enter.apply(targetViewState, args);
                  previousViewState.cleanup();
                }
              } else {
                // different view state
                viewState = previousViewState;
                while (viewState) {
                    viewState.destroy();
                    viewState = viewState.parent;
                }
              }
            }

            this._routeParams = args.concat();
            targetViewState._handleEnter.apply(targetViewState, args);
            this.trigger('nav', targetViewState.name);
        },

        _isValidParent: function(args) {
          if (!this._routeParams) return false;
          var result = true;

          for (var i = 0, l = args.length; i < l; ++i) {
            if (args[i] != this._routeParams[i]) {
              result = false;
              break;
            }
          }

          return result;
        },

        register: function(ViewState) {
            var viewState = this._getInstance(ViewState);
            this.route(viewState);
            Backbone.application.registerModule(ViewState);
            return this;
        },

        registerSubViewState: function(ViewState, parentViewState) {
            this._getInstance(ViewState).parent = this._getInstance(parentViewState);
            this.register(ViewState);
            return this;
        },

        route: function(viewState) {
            this.router.route(viewState.path, viewState.name, this._handleRoute.bind(this, viewState));
        }
    };

    _.extend(RouteManager.prototype, Backbone.Events);


    Backbone.install = function(options, callback) {
        var application = new Application(options);
        var routerManager = new RouteManager();
        Backbone.application = application;
        Backbone.routerManager = routerManager;
        callback(application, routerManager);
    };



    var Application = function(options) {
        this._configure(options || {});
    };

    Application.prototype._configure = function(options) {
        this.el = options.el;
        this.$el = $(this.el);
        this.modules = {};
        this._caches = {};
    };

    Application.prototype.registerModule = function(module) {
        var formattedModule = _.isFunction(module) ? { main: module } : module
        this.modules[formattedModule.main.prototype.name] = formattedModule
    }

    Application.prototype.getModuleInstance = function(name, options) {
        var module = this.getModule(name)
          , result = new module.main(_.extend({}, module.args, options));

        if (module.childConfig) result.childConfig = _.extend({}, module.childConfig)
        return result;
    }

    Application.prototype.getModule = function(nameOrModule, main) {
      var name =  _.isString(nameOrModule) ? nameOrModule : nameOrModule.name
        , module = this.modules[name];
      if (!module) throw Error('Can not find module ' + name);
      return main ? module.main : module;
    }

    Application.prototype.moduleHasModel = function(name) {
      return this.getModule(name, true).prototype.model;
    };

    var Module = Backbone.View.extend({
        initialize: function() {
            var tpl;

            if (this.template instanceof Element) {
                tpl = this.template.innerHTML;
            } else if (typeof this.template == 'string') {
                tpl = this.template;
            }

            if (tpl) this.template = Handlebars.compile(tpl);

            this.modules = new ArraySet();
            this.active = false;
        },


        /**
         * Enter this module and trigger events
         */
        _handleEnter: function() {
            if (this.active || this.options.render === false) return;

            var args = slice.call(arguments);
            this.beforeEnter.apply(this, args);

            if (this.status != 'ready') {
                this._prepareRender().done(function(module) {
                    Backbone.application._currentModule = module;
                    module
                      ._render()
                      ._handleChildEnter.apply(module, args);
                });
            }

            this.enter.apply(this, args);
            this.active = true;
            return this;
        },

        _handleChildEnter: function() {
            var args = slice.call(arguments);

            this.modules.chain().filter(function(module) {
                return !module.active;
            }).each(function(module) {
                module._handleEnter.apply(module, args);
            });
        },

        registerModule: function(moduleOrName) {
            var module = _.isString(moduleOrName)
                        ? Backbone.application.getModuleByName(moduleOrName)
                        : moduleOrName;
            this.modules.add(module.id, module);
            module.parent = this;
            return this;
        },

        getChildModuleById: function(id) {
            return this.modules.get(id);
        },

        getChildModuleByName: function(name) {
            var result = [];

            this.modules.chain().each(function(module) {
                if (module.name == name) {
                    result.push(module);
                }
            });

            return result;
        },

        setChildConfig: function(name, config) {
          this.childConfig = this.childConfig || {};
          this.childConfig[name] = $.extend({}, this.childConfig[name], config);
        },

        refresh: function() {
            this.cleanup();
            this.options.render = true;
            this._handleEnter.apply(this, arguments);
            return this;
        },

        render: function() {
            this._handleEnter.apply(this, arguments);
            return this;
        },

        /**
         * Render template with data
         */
        _render: function() {
            var data = this.model ? this.model.toJSON() : {};
            var html = typeof this.template == 'function' ? this.template(data) : this.template;

            this.$el.html(html);

            var placeholderID = this.id + '-placeholder'
              , placeholderEl = document.getElementById(placeholderID);
            //Already in html
            if (!placeholderEl && this.parent) {
              placeholderEl = this.parent.el.querySelector('#' + placeholderID)
            }

            if (placeholderEl) {
              $(placeholderEl).replaceWith(this.$el);
            }

            this.delegateEvents();
            this.trigger('ready').status = 'ready';
            this._checkStatus(this);

            return this;
        },

        _checkStatus: function(module) {
            if (!module) return;

            var total = module.modules.toArray().length;
            if (total == 0 || module.modules.filter(function(module) {
                return module.status == 'loaded';
            }).length == total) {
                module.status = 'loaded';
                module.trigger('load');
                module._checkStatus(module.parent);
            }
        },

        /**
         * Append one module to another module with an optional dom selector
         *
         * @param module {Backbone.Module}
         * @param selector [String]
         * @param args Array
         */
        append: function(module, selector, args) {
            if (Array.isArray(selector)) {
                args = selector;
                selector = null;
            }

            args = args || [];

            var container = selector ? this.el.querySelector(selector) : this.el;
            container.appendChild(module.el);

            this.registerModule(module);
            module._handleEnter.apply(module, args);
            return this;
        },

        delegateReady: function(moduleName, func) {
            this.modules.chain().each(function(module) {
                if (module.name == moduleName) {
                    module.onReady(func);
                }
                module.delegateReady(moduleName, func);
            });
        },

        delegate: function(moduleName, eventName, func) {
            this.modules.chain().each(function(module) {
                if (module.name == moduleName) {
                    module.on(eventName, func);
                }
                module.delegate(moduleName, eventName, func);
            });
        },

        // Events
        beforeEnter: function() {},

        enter: function() {},

        destroy: function() {
          this.cleanup();
          this.off(); // Remove all events

          if (this instanceof ViewState) {
            this.$el.empty();
          } else {
            this.remove();
            if (this.parent) {
              this.parent.modules.remove(this.id);
            }
          }
        },

        cleanup: function() {
          this.active = false;
          this.status = '';
          this.undelegateEvents();

          this.modules.forEach(function(module) {
              module.destroy();
          });
          this.modules = new ArraySet();
        },

        onReady: function(func) {
            if (this.status == 'loaded' || this.status == 'ready') return func.call(this);
            this.on('ready', func, this);
        },

        _ensureElement: function() {
          if (!this.el) {
            var attrs = getValue(this, 'attributes') || {};
            this.id = this.id || _.uniqueId('m');
            attrs.id = this.id;
            var className = this.name;
            if (this.className) className += ' ' + this.className;
            attrs['class'] = className;
            var content = typeof this.placeholder == 'string' ? this.placeholder : '';
            this.setElement(this.make(this.tagName, attrs, content), false);
          } else {
            this.setElement(this.el, false);
          }
        },

        _prepareRender: function() {
            var model = this.model
              , self = this
              , dtd = $.Deferred();

            if (getValue(model, 'url')) {
                var fetchOptions = {
                    data: this.options.data,
                    success: function() {
                      dtd.resolve(self);
                    }
                }
                model.fetch(fetchOptions);
            } else {
              dtd.resolve(this);
            }

            return dtd;
        }
    });

    Module.extend = Backbone.View.extend;

    _.extend(Module.prototype, Backbone.Events);


    var ViewState = Module.extend({

        transition: function() {},

        _handleEnter: function() {
            if (this.parent) {
                this.parent._handleEnter.apply(this.parent, arguments);
            }

            ViewState.__super__['_handleEnter'].apply(this, arguments);
        },

        isParentOf: function(viewState) {
            var tmp = viewState, result = false;

            do {
                tmp = tmp && tmp.parent;
                if (tmp == this) {
                    result = true;
                    break;
                }
            } while(tmp);

            return result;
        },

        isSibling: function(viewState) {
          return this.parent && (this.parent === viewState.parent);
        },

        isActive: function() {
          return this === Backbone.routerManager.activeViewState;
        }
    });

    ViewState.mergedOptions = ['path'];


    Handlebars.registerHelper('module', function(context, options) {
        if (_.isUndefined(options)) {
            options = context;
            context = null;
        }

        var name = options.hash.name
          , application = Backbone.application
          , currentModule = application._currentModule
          , moduleOptions = _.extend({}, currentModule.childConfig
                                          && currentModule.childConfig[name])

        if (!application.moduleHasModel(name) && !moduleOptions.module) {
            var Model = Backbone.Model.extend({ url: null });
            moduleOptions.model = new Model(context || {});
        }

        var module = application.getModuleInstance(name, moduleOptions)
        currentModule.registerModule(module);
        module.renderByTemplate = true;
        var placeHolderHtml = '<div id="' + module.id + '-placeholder">'
            + (module.placeholder || 'Loading..')
            + '</div>';

        return placeHolderHtml
    });


    ViewState.extend = Backbone.View.extend;

    Backbone.ViewState = ViewState;
    Backbone.Module = Module;
    Backbone.RouteManager = RouteManager;
}());
