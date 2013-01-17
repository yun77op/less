define(function (require) {

    var tpl = require('../views/mini-stream-item.tpl');

    return Backbone.Module.extend({
        name: 'mini-stream-item',

        className:'stream-item',

        tagName: 'li',

        template: tpl,

        events: {
            'click .action-reply': 'reply'
        },

        beforeEnter: function() {
            this.model.set('action_list', {
                repost: true
            })
        },

        reply: function() {

        }

    });

});