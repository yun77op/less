<div class="stream-item-footer">
    <span class="metadata">
        <a href="#!/statuses/{{id}}">{{#date_format
            created_at}}{{/date_format}}</a>
        <span i18n-content="from">from</span> {{{ source }}}
    </span>
    <ul class="actions">
        <li>
            <a href="#" title="Favorite" class="action-favorite{{#if favorited}} favorited{{/if}}" i18n-values="title:favorite">
                <span class="icon icon-16 icon-favorite"></span>
            </a>
        </li>
        <li>
            <a href="#" title="Repost" class="action-repost" i18n-values="title:repost">
                <span class="icon icon-16 icon-repost"></span>
                {{ reposts_count }}
            </a>
        </li>
        <li>
            <a href="#" title="Comment" class="action-comment" i18n-values="title:comment">
                <span class="icon icon-16 icon-comment"></span>
                {{ comments_count }}
            </a>
        </li>
    </ul>
</div>