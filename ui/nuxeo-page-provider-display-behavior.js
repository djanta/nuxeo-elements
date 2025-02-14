/**
@license
(C) Copyright Nuxeo Corp. (http://nuxeo.com/)

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
import '@polymer/polymer/polymer-legacy.js';

import { dom } from '@polymer/polymer/lib/legacy/polymer.dom.js';
import { Debouncer } from '@polymer/polymer/lib/utils/debounce.js';
import { timeOut } from '@polymer/polymer/lib/utils/async.js';
import { afterNextRender } from '@polymer/polymer/lib/utils/render-status.js';
import { config } from '@nuxeo/nuxeo-elements';
import { I18nBehavior } from './nuxeo-i18n-behavior.js';

/**
 * @polymerBehavior Nuxeo.PageProviderDisplayBehavior
 */
export const PageProviderDisplayBehavior = [
  I18nBehavior,
  {
    properties: {
      nxProvider: {
        type: HTMLElement,
      },

      size: {
        type: Number,
        value: 0,
        notify: true,
      },

      emptyLabel: {
        type: String,
      },

      emptyLabelWhenFiltered: {
        type: String,
      },

      _computedEmptyLabel: {
        type: String,
      },

      _isEmpty: {
        type: Boolean,
        value: true,
      },

      _isSelectAllActive: {
        type: Boolean,
        value: false,
        notify: true,
      },

      _isSelectAllIndeterminate: {
        type: Boolean,
        value: false,
        notify: true,
      },

      _isSelectionEmpty: {
        type: Boolean,
        value: true,
        notify: true,
      },

      multiSelection: {
        type: Boolean,
        value: false,
      },

      /**
       * An array with objects containing path, filter value, name and expression that are used to filter the items
       */
      filters: {
        type: Array,
        notify: true,
        value: [],
      },

      /**
       * An array with a path/sortorder ('asc' or 'desc') pairs that are used to sort the items.
       */
      sortOrder: {
        type: Array,
        notify: true,
        value() {
          return [];
        },
      },

      _ppSort: {
        type: Object,
        value: {},
        notify: true,
      },

      /**
       * `true` if the table is currently loading data from the data source.
       */
      loading: {
        type: Boolean,
        reflectToAttribute: true,
        notify: true,
        readOnly: true,
        value: false,
      },

      selectionEnabled: {
        type: Boolean,
        value: false,
      },

      /**
       * `true` if select all mode is currently enabled. For select all to work, selection must be enabled too.
       */
      selectAllEnabled: {
        type: Boolean,
        value: false,
      },

      /**
       * `true` if select all is active, i.e. all the items are selected.
       */
      selectAllActive: {
        type: Boolean,
        notify: true,
        computed: '_computeSelectAllStatus(selectAllEnabled, _isSelectAllActive)',
      },

      selectedItems: {
        type: Object,
        notify: true,
      },

      selectedItem: {
        type: Object,
        notify: true,
      },

      items: {
        type: Array,
        value: [],
        notify: true,
      },

      /**
       * Use this property to limit the maximum number of items.
       */
      maxItems: {
        type: Number,
        value() {
          return config.get('listingMaxItems', 10000);
        },
      },

      /**
       * Number of items to fetch ahead of current range limit.
       */
      _fetchAheadLimit: {
        type: Number,
        value: 10,
      },

      selectOnTap: {
        type: Boolean,
        value: false,
      },

      as: {
        type: String,
        value: 'item',
      },

      quickFilters: {
        type: Array,
        notify: true,
      },

      scrollThrottle: {
        type: Number,
        value: 60,
      },

      handlesSorting: {
        type: Boolean,
        reflectToAttribute: true,
        value: false,
      },

      handlesFiltering: {
        type: Boolean,
        reflectToAttribute: true,
        value: false,
      },

      handlesSelectAll: {
        type: Boolean,
        reflectToAttribute: true,
        value: false,
      },

      _lastSelectedIndex: Number,
    },

    observers: [
      '_updateFlags(size)',
      '_nxProviderChanged(nxProvider)',
      '_selectionEnabledChanged(selectionEnabled, selectOnTap)',
      '_itemsChanged(items.*)',
      '_computeLabel(i18n, emptyLabel, filters, loading, size, _isEmpty)',
    ],

    listeners: {
      'column-filter-changed': '_onColumnFilterChanged',
      selected: '_selected',
    },

    detached() {
      this.unlisten(this.nxProvider, 'update', '_updateResults');
      this.unlisten(this.nxProvider, 'loading-changed', '_updateLoading');
      this.$.list.unlisten.call(this.$.list, this.$.list, 'selected', '_selectionHandler');
      this.$.list.unlisten.call(this.$.list, this.$.list, 'tap', '_selectionHandler');
    },

    _nxProviderChanged(nxProvider) {
      if (typeof nxProvider === 'string') {
        this.nxProvider = this.__dataHost
          ? this.__dataHost.$[nxProvider]
          : dom(this.ownerDocument).querySelector(`#${nxProvider}`);
        if (this.nxProvider === null) {
          this.nxProvider = dom(this).parentNode.querySelector(`#${nxProvider}`);
        }
      } else if (nxProvider) {
        this._pageSize = this.nxProvider.pageSize;
        this.listen(this.nxProvider, 'loading-changed', '_updateLoading');
        this.listen(this.nxProvider, 'update', '_updateResults');
      }
    },

    _updateLoading() {
      this._setLoading(this.nxProvider.loading);
    },

    _hasPageProvider() {
      return this.nxProvider && typeof this.nxProvider !== 'string';
    },

    _resetResults() {
      if (this._hasPageProvider()) {
        this._reset(0);
      }
    },

    _updateResults() {
      if (this._hasPageProvider()) {
        this.size = this.items.length;
      }
    },

    _itemsChanged() {
      this._isEmpty = !(this.items && this.items.length > 0);
    },

    _selected(e) {
      const { index } = e.detail;
      if (typeof index === 'number') {
        if (e.detail.shiftKey && typeof this._lastSelectedIndex === 'number') {
          // prevent selecting an item not loaded yet
          if (!this.items[index] || !this.items[index].uid) {
            this.deselectIndex(index);
          }

          const last = this._lastSelectedIndex;
          const start = index > last ? last : index;
          const end = index > last ? index : last;

          // check if all items in the range are loaded
          const valid = this.items.slice(start, end).every((item) => item && item.uid);

          // select items in range
          if (valid) {
            for (let i = start; i < end; i++) {
              const item = this.items[i];
              if (item && item.uid) {
                this.selectItem(item);
              }
            }
          }
        }
        // until we support unselect some, if the view is not handling select all, we need to prevent deselect (for now)
        if (this.selectAllActive && !this.handlesSelectAll) {
          this.selectItem(this.items[index]);
        }
        this._lastSelectedIndex = e.detail.index;
      }
    },

    selectItem(item) {
      if (this.selectionEnabled) {
        this.$.list.selectItem(item);
        this._updateFlags();
      }
    },

    selectIndex(index) {
      if (this.selectionEnabled) {
        this.$.list.selectIndex(index);
        this._updateFlags();
      }
    },

    selectItems(items) {
      if (this.selectionEnabled && items && items.length > 0) {
        items.forEach(
          function(item) {
            this.selectItem(item);
          }.bind(this.$.list),
        );
        this._updateFlags();
      }
    },

    deselectItem(item) {
      if (this.selectionEnabled && !this.selectAllActive) {
        this.$.list.deselectItem(item);
        this._updateFlags();
      }
    },

    deselectIndex(index) {
      if (this.selectionEnabled && !this.selectAllActive) {
        this.$.list.deselectIndex(index);
        this._updateFlags();
      }
    },

    selectAll() {
      if (this.selectionEnabled && this.selectAllEnabled) {
        this._isSelectAllActive = true;
        // select the visible items first to speed up the first paint (the others can be deferred)
        const { start, end } = this._getSelectionBoundaries();
        this._updateSelectedItems((index) => {
          this.selectItem(this.items[index]);
        });

        // push the items before the range
        afterNextRender(this, this._pushSelectedItems, [0, start]);
        // push the items after the range
        afterNextRender(this, this._pushSelectedItems, [end + 1, this.items.length]);
      }
    },

    clearSelection() {
      this.$.list.clearSelection();
      this._isSelectAllActive = false;
      this._updateFlags();
    },

    /**
     * Basic helper method to push items to selected items without proper selection, to speed up rendering.
     */
    _pushSelectedItems(indexStart, limit) {
      for (let index = indexStart; index < limit; index++) {
        this.selectedItems.push(this.items[index]);
      }
      this.notifySplices('selectedItems');
    },

    /**
     * `true` if select all is enabled and all items are checked
     */
    _computeSelectAllStatus() {
      return this.selectAllEnabled && this._isSelectAllActive;
    },

    _isSelected(item) {
      return !!(this.selectedItems && this.selectedItems.length && this.selectedItems.indexOf(item) > -1);
    },

    _toggleSelectAll() {
      if (this.selectAllActive) {
        this.clearSelection();
      } else {
        this.selectAll();
      }
    },

    _selectionEnabledChanged() {
      this.$.list.selectionEnabled = this.selectionEnabled;
      this.$.list.multiSelection = this.multiSelection;
      this.$.list.unlisten.call(this.$.list, this.$.list, 'selected', '_selectionHandler');
      if (this.selectionEnabled && !this.selectOnTap) {
        this.$.list.unlisten.call(this.$.list, this.$.list, 'tap', '_selectionHandler');
        this.$.list.listen.call(this.$.list, this.$.list, 'selected', '_selectionHandler');
      }
    },

    _sortDirectionChanged(e) {
      if (this._hasPageProvider()) {
        let notFound = true;
        for (let i = 0; i < this.sortOrder.length; i++) {
          if (this.sortOrder[i].path === e.detail.path) {
            if (e.detail.direction) {
              this.set(`sortOrder.${i}.direction`, e.detail.direction);
            } else {
              this.splice('sortOrder', i, 1);
            }
            notFound = false;
            break;
          }
        }
        if (notFound) {
          this.push('sortOrder', {
            path: e.detail.path,
            direction: e.detail.direction,
          });
        }

        // TODO make it simpler
        const tmpSort = {};
        if (this.sortOrder && this.sortOrder.length > 0) {
          this.sortOrder.forEach((sortItem) => {
            tmpSort[sortItem.path] = sortItem.direction;
          });
        }
        if (JSON.stringify(this._ppSort) !== JSON.stringify(tmpSort)) {
          this.clearSelection();
          this._ppSort = tmpSort;
          this.nxProvider.sort = this._ppSort;
          if (!this.nxProvider.auto) {
            this.fetch();
          }
        }
      }
    },

    _onColumnFilterChanged(e) {
      if (this._hasPageProvider()) {
        let notFound = true;
        for (let i = 0; i < this.filters.length; i++) {
          if (this.filters[i].path === e.detail.filterBy) {
            if (e.detail.value.length === 0) {
              this.splice('filters', i, 1);
            } else {
              this.set(`filters.${i}.value`, e.detail.value);
            }
            notFound = false;
            break;
          }
        }

        if (notFound && e.detail.value.length !== 0) {
          this.push('filters', {
            path: e.detail.filterBy,
            value: e.detail.value,
            name: e.detail.name,
            expression: e.detail.filterExpression,
          });
        }

        if (this.paginable) {
          this.nxProvider.page = 1;
        }

        if (this.nxProvider.params[e.detail.filterBy] && e.detail.value.length === 0) {
          this.clearSelection();
          delete this.nxProvider.params[e.detail.filterBy];
          this.fetch();
        } else if (e.detail.value.length > 0) {
          this.clearSelection();
          if (e.detail.filterExpression) {
            this.nxProvider.params[e.detail.filterBy] = e.detail.filterExpression.replace(/(\$term)/g, e.detail.value);
          } else {
            this.nxProvider.params[e.detail.filterBy] = e.detail.value;
          }
          this.fetch();
        }
      }
    },

    scrollToItem(item) {
      this.$.list.scrollToItem(item);
    },

    scrollToIndex(index) {
      this.$.list.scrollToIndex(Math.min(Math.max(index, 0), this.items.length - 1));
    },

    focusOnIndexIfNotVisible(index) {
      if (!this.$.list._isIndexVisible(index)) {
        this.$.list.scrollToIndex(index);
      }
    },

    _computeLabel() {
      this._computeLabelDebouncer = Debouncer.debounce(this._computeLabelDebouncer, timeOut.after(500), () => {
        if (this.loading) {
          this._computedEmptyLabel = this.i18n('label.loading');
        } else if (this.filters && this.filters.length > 0) {
          this._computedEmptyLabel = this.emptyLabelWhenFiltered
            ? this.emptyLabelWhenFiltered
            : this.i18n('label.noResultsWhenFiltered');
        } else {
          this._computedEmptyLabel = this.emptyLabel ? this.emptyLabel : this.i18n('label.noResults');
        }
      });
    },

    _quickFilterChanged() {
      this.fetch();
    },

    _updateFlags() {
      this.size = Array.isArray(this.items) ? this.items.length : 0;
      const selectedItemsSize = Array.isArray(this.selectedItems) ? this.selectedItems.length : 0;
      this._isSelectAllIndeterminate = !this._isSelectAllActive || selectedItemsSize < this.size;
      this._isEmpty = this.size === 0;
    },

    /**
     * This function can be overridden by elements that includes this behavior.
     * That allows to use different items array initialization.
     */
    reset(size) {
      this._reset(size);
    },

    _reset(size) {
      if (this.maxItems && size && size > this.maxItems) {
        size = this.maxItems;
      }
      this.set('items', []);
      if (typeof size === 'number' && size > 0) {
        const arr = new Array(size);
        for (let i = 0; i < arr.length; i++) {
          arr[i] = {};
        }
        this.set('items', arr);
      }
      this.size = this.items.length;
      // if reset is called we need to clear selection
      this.clearSelection();
      this.$.list.notifyResize();
    },

    /**
     * This function can be overridden by elements that includes this behavior.
     * That allows to use either range OR page based fetch APIs.
     * Default behavior is range base fetching.
     */
    fetch() {
      if (this._hasPageProvider()) {
        return this._fetchRange(0, this._pageSize - 1, true);
      }
      return Promise.resolve();
    },

    /**
     * Fetch a page and push the results to the items array.
     *
     * @param page Page index to fetch
     * @param pageSize Number of results per page
     */
    _fetchPage(page, pageSize) {
      if (this._hasPageProvider()) {
        const options = {
          skipAggregates: page && page > 1,
        };
        if (page) {
          this.nxProvider.page = page;
        }
        if (pageSize) {
          this.nxProvider.pageSize = pageSize;
        }
        this.nxProvider.offset = 0;
        return this.nxProvider.fetch(options).then((response) => {
          if (page === 1) {
            this.reset();
          }
          for (let i = 0; i < response.entries.length; i++) {
            this.push('items', response.entries[i]);
          }
          return response;
        });
      }
      return Promise.resolve();
    },

    /**
     * Fetch a range of items (and fill the items array accordingly)
     *
     * @param firstIndex First index to fetch
     * @param lastIndex Last index to fetch
     * @param clear Clear items array
     */
    _fetchRange(firstIndex, lastIndex, clear) {
      if (this._hasPageProvider()) {
        if (firstIndex === 0) {
          lastIndex = this._pageSize - 1;
        }

        if (this.maxItems && lastIndex > this.maxItems) {
          lastIndex = this.maxItems;
          clear = true;
        } else if (firstIndex > 0) {
          lastIndex += this._fetchAheadLimit;
          if (this.maxItems) {
            lastIndex = Math.min(lastIndex, this.maxItems - 1);
          }
        }

        if (!clear && this.items && this.items.length) {
          const shouldLoad = this.items.slice(firstIndex, lastIndex).some((el, idx) => {
            if (!el || (Object.keys(el).length === 0 && el.constructor === Object)) {
              firstIndex += idx;
              return true;
            }
            return false;
          });
          if (!shouldLoad) {
            return;
          }
        }

        // update items array based on first and last visible indexes
        this.nxProvider.offset = firstIndex;
        this.nxProvider.page = 1;
        this.nxProvider.pageSize = lastIndex - firstIndex + 1;
        const options = {
          skipAggregates: firstIndex !== 0,
        };
        return this.nxProvider.fetch(options).then((response) => {
          if (!response) {
            return;
          }

          // get results count, and reset the array if it differs from current array length
          let count;
          if (response.resultsCount < 0) {
            // negative resultCount means unknown value, fall back on currentPageSize
            count = response.resultsCountLimit > 0 ? response.resultsCountLimit : response.currentPageSize;
          } else if (response.resultsCountLimit > 0 && response.resultsCountLimit < response.resultsCount) {
            count = response.resultsCountLimit;
          } else {
            count = response.resultsCount;
          }
          if (this.maxItems) {
            if (count > this.maxItems) {
              count = this.maxItems;
            }
          }
          if (clear || this.items.length !== count) {
            this.reset(count);
          }

          // fill items range based on response
          let entryIndex = 0;
          for (let i = firstIndex; i <= lastIndex; i++) {
            if (entryIndex < response.entries.length) {
              const isSelected = this._isSelected(this.items[i]);

              this.set(`items.${i}`, response.entries[entryIndex++]);

              if (isSelected) {
                if (this.selectAllActive) {
                  /**
                   * if select all is active we need to update the `selectedItems` entry to keep it in sync with the
                   * one in `items` that we have just loaded
                   */
                  this.set(`selectedItems.${i}`, this.items[i]);
                  this._selectItemModel(i);
                } else {
                  this.selectIndex(i);
                }
              }
            }
          }

          // quick filters
          this.quickFilters = this.nxProvider.quickFilters;

          // check if there is any active quick filter
          const hasActiveQuickFilters = this.quickFilters
            ? Object.keys(this.quickFilters).some((k) => this.quickFilters[k].active)
            : false;

          // update buckets array based on provider's sort property
          let buckets = [];
          if (response.aggregations && !hasActiveQuickFilters) {
            const providerSort = this.nxProvider.sort;
            if (providerSort && Object.keys(providerSort).length === 1) {
              const providerField = Object.keys(providerSort)[0];
              const providerOrder = providerSort[providerField];
              Object.keys(response.aggregations).forEach((key) => {
                const aggregation = response.aggregations[key];
                if (
                  aggregation.field === providerField &&
                  aggregation.buckets.length >= buckets.length &&
                  aggregation.properties &&
                  aggregation.properties.order
                ) {
                  const order = aggregation.properties.order.split(' ');
                  if (order.length > 0 && order[0] === 'key') {
                    ({ buckets } = aggregation);
                  }
                  if (order.length > 1 && order[1] !== providerOrder) {
                    buckets.reverse();
                  }
                }
              });
            }
            this.set('buckets', buckets);
          }

          this.fire('nuxeo-page-loaded');
        });
      }
      return Promise.resolve();
    },

    /**
     * Returns the boundaries used by the optimization mechanism in select all
     */
    _getSelectionBoundaries() {
      const n = Math.max(0, this.$.list.lastVisibleIndex - this.$.list.firstVisibleIndex);
      return {
        start: Math.max(0, this.$.list.firstVisibleIndex - n),
        end: Math.min(this.items.length, this.$.list.lastVisibleIndex + n),
        n,
      };
    },

    /**
     * Generic method used to perform a custom selection callback used by the optimization mechanism in select all
     */
    _updateSelectedItems(selectionCallback) {
      const { start, end } = this._getSelectionBoundaries();
      for (let index = start; index <= end; index++) {
        selectionCallback(index);
      }
    },

    /**
     * Method to force the selection of the items that are already rendered by the internal list.
     *
     * This solution is needed for the optimizations of the select all mechanism, where all items are considered
     * selected for fast rendering, but are updated on demand when we fetch subsequent page provider pages.
     * It is inspired by the select all proposal in https://github.com/PolymerElements/iron-list/pull/457
     */
    _selectItemModel(index) {
      if (this.$.list._isIndexRendered(index)) {
        const model = this.modelForElement(this.$.list._physicalItems[this.$.list._getPhysicalIndex(index)]);
        if (model && !model[this.$.list.selectedAs]) {
          model[this.$.list.selectedAs] = true;
        }
      }
    },

    _scrollChanged() {
      this._debouncer = Debouncer.debounce(
        this._debouncer,
        timeOut.after(this.scrollThrottle > 0 ? this.scrollThrottle : 1),
        () => {
          /**
           * if select all is checked we need to update the model to reflect the changes, since not all the items were
           * visible in the first place
           */
          if (this.selectAllActive) {
            afterNextRender(this, () => this._updateSelectedItems(this._selectItemModel.bind(this)));
          }
          this._fetchRange(this.$.list.firstVisibleIndex, this.$.list.lastVisibleIndex);
        },
      );
    },

    modelForElement(el) {
      return this.$.list.modelForElement(el);
    },
  },
];
