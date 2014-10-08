/**
 * Return an instance of Listing.
 *
 * @constructor
 * @param {Object} options - instance options
 */
var Listing = function(options) {
    this.initialize(options);
};

Listing.prototype = {
    constructor: Listing,

    listing_defaults: {
        presp_container: '#pagination-responsive',
        pbar_container: '#bottom-bar-right',
        pbar_id: '#pagination_bar',
        sortable_selector: '.sortable',
        with_searchform: true,
        load_page_url: null,
        navigation_params: ["sort_order", "searchquery"]
    },

    initialize: function(options) {
        this.options = $.extend({}, this.listing_defaults, options);
        this.tag_handlers = {};
        this.navobj = new History(this.options);
        $(document).on("click", this.options.pbar_container + " a",
            $.proxy(this.load_page, this));
        $(document).on("click", this.options.presp_container + " a",
            $.proxy(this.load_page, this));
        if (this.options.with_searchform) {
            this.init_searchform();
        }
    },

    /**
     * Initialize the search form.
     */
    init_searchform: function() {
        $("#searchquery").focus(function() {
            $(this).val("");
        }).blur($.proxy(function(e) {
            var $this = $(e.target);
            if ($this.val() === "") {
                if (this.navobj.getparam("searchquery")) {
                    $this.val(this.navobj.getparam("searchquery"));
                } else {
                    $this.val(gettext("Search"));
                }
            }
        }, this));
        if (this.navobj.getparam("searchquery") !== undefined) {
            $("#searchquery").val(this.navobj.getparam("searchquery"));
        }
        $("#searchform").submit($.proxy(this.do_search, this));
    },

    /**
     * Apply the current search pattern.
     */
    do_search: function(e) {
        e.preventDefault();
        var squery = $("#searchquery").val();
        if (squery !== "") {
            this.navobj.setparam("searchquery", squery);
        } else {
            this.navobj.delparam("searchquery");
        }
        this.navobj.update();
    },


    load_page: function(e) {
        var $link = get_target(e, "a");
        e.preventDefault();
        this.navobj.updateparams($link.attr("href")).update();
    },

    /**
     * Return extra arguments used to fetch a page.
     *
     * @this Listing
     */
    get_load_page_args: function() {
        var $this = this;
        var args = {};

        $.each(this.options.navigation_params, function(pos, param) {
            if ($this.navobj.hasparam(param)) {
                args[param] = $this.navobj.getparam(param);
            }
        });
        return args;
    },

    /**
     * Update the listing with the received data.
     *
     * @this Listing
     * @param {Object} data - new content
     */
    update_listing: function(data) {
        if ($(window).data("infinite-scroll") !== undefined) {
            $(window).infinite_scroll("reset_loaded_pages", data.page);
        } else {
            $(window).infinite_scroll({
                url: this.options.load_page_url,
                get_args: $.proxy(this.get_load_page_args, this),
                calculate_bottom: function($element) {
                    var $last_row = $("#objects_table").find("tr").last();
                    return $last_row.offset().top - $element.height();
                },
                process_results: this.add_new_page,
                end_of_list_reached: this.end_of_list_reached
            });
        }

        var $sortables = $(this.options.sortable_selector);
        if ($sortables.length) {
            $(this.options.sortable_selector).sortable({
                onSortOrderChange: $.proxy(this.change_sort_order, this)
            });
            this.set_sort_order();
        }
    },

    /**
     * Set current sort order.
     *
     * @this Listing
     */
    set_sort_order: function() {
        var sort_order = this.navobj.getparam("sort_order");
        var sort_dir;

        if (!sort_order) {
            return;
        }
        if (sort_order[0] == '-') {
            sort_dir = "desc";
            sort_order = sort_order.substr(1);
        } else {
            sort_dir = 'asc';
        }
        $("th[data-sort_order=" + sort_order + "]").sortable('select', sort_dir);
    },

    /**
     * Change current sort order.
     *
     * @this Listing
     */
    change_sort_order: function(sort_order, dir) {
        if (dir == "desc") {
            sort_order = "-" + sort_order;
        }
        this.navobj.setparam("sort_order", sort_order).update();
    },

    /**
     * Register a new tag handler.
     *
     * @this Listing
     * @param {string} name - name of the tag
     * @param {function} handler - reference to a function (optional)
     */
    register_tag_handler: function(name, handler) {
        if (handler === undefined) {
            handler = this.generic_tag_handler;
        }
        this.tag_handlers[name] = handler;
        if (this.navobj.getparam(name + "filter") !== undefined) {
            var text = this.navobj.getparam(name + "filter");
            $("#taglist").append(this.make_tag(text, name));
        }
    },

    /**
     * Default tag handler.
     *
     * @this Listing
     * @param {string} tag - name of the tag
     * @param {Object} $link - tag that was clicked
     * @return {boolean} - return true if handler has been executed
     */
    generic_tag_handler: function(tag, $link) {
        if (this.navobj.getparam(tag + "filter") === undefined && $link.hasClass(tag)) {
            var text = $link.attr("name");
            this.navobj.setparam(tag + "filter", text).update();
            $("#taglist").append(this.make_tag(text, tag));
            return true;
        }
        return false;
    },

    /**
     * Build a button to remove a specific filter.
     *
     * @this Listing
     * @param {string} text - text of the button
     * @param {string} type - tag type
     * @return {Object} - new button object
     */
    make_tag: function(text, type) {
        var $tag = $("<a />", {
            "name": type, "class" : "btn btn-default btn-xs",
            "html": " " + text
        });
        
        $("<span />", {"class" : "fa fa-remove"}).prependTo($tag);
        $tag.click($.proxy(this.remove_tag, this));
        return $tag;
    },

    /**
     * Click event : remove a tag button.
     *
     * @this Listing
     * @param {Object} e - event object
     */
    remove_tag: function(e) {
        var $tag = $(e.target);

        if ($tag.is("i")) {
            $tag = $tag.parent();
        }
        e.preventDefault();
        this.navobj.delparam($tag.attr("name") + "filter").update();
        $tag.remove();
    },

    /**
     * Click event: filter the listing when a tag is clicked.
     *
     * @this Listing
     * @param {Object} e - event object
     */
    filter_by_tag: function(e) {
        var $link = $(e.target);
        e.preventDefault();

        for (var name in this.tag_handlers) {
            if (this.tag_handlers[name].apply(this, [name, $link])) {
                break;
            }
        }
    }
};
