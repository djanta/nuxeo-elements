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
import { html } from '@polymer/polymer/lib/utils/html-tag.js';
import './nuxeo-element.js';
import './nuxeo-connection.js';

{
  /**
   * `nuxeo-operation` allows calling an operation on a Nuxeo server.
   *
   *     <nuxeo-operation auto
   *                      op="Document.Query"
   *                      params='{"query": "select * from Document"}'
   *                      on-response="handleResponse"
   *                      enrichers="documentURL, preview"></nuxeo-operation>
   *
   * With `auto` set to `true`, the operation is executed whenever
   * its `url` or `params` properties are changed.
   *
   * Note: The `params` attribute must be double quoted JSON.
   *
   * You can trigger an operation explicitly by calling `execute` on the
   * element.
   *
   * @memberof Nuxeo
   */
  class Operation extends Nuxeo.Element {
    static get template() {
      return html`
        <style>
          :host {
            display: none;
          }
        </style>
        <nuxeo-connection id="nx" connection-id="{{connectionId}}"></nuxeo-connection>
      `;
    }

    static get is() {
      return 'nuxeo-operation';
    }

    static get properties() {
      return {
        /** The id of a nuxeo-connection to use. */
        connectionId: {
          type: String,
          value: '',
        },

        /** The success response status */
        success: {
          type: Boolean,
          notify: true,
        },

        /** The error response status */
        error: {
          type: String,
          notify: true,
        },

        /** Indicates if the request behind this operation cannot be canceled.
         * By default a request is cancelable, which means that if on the same `nuxeo-operation`
         * we perform two sequential requests: Request A & Request B. The first one will be
         * aborted and we keep the last one (in our case request B). This is done to avoid
         * an obsolete responses.
         * */
        uncancelable: {
          type: Boolean,
        },

        /** The id the operation to call. */
        op: {
          type: String,
          value: '',
        },

        /** The parameters to send. */
        params: {
          type: Object,
          value: {},
        },

        /** The operation input. */
        input: {
          type: Object,
        },

        /** If true, automatically execute the operation when either `op` or `params` changes. */
        auto: {
          type: Boolean,
          value: false,
        },

        /** The response from the server. */
        response: {
          type: Object,
          value: null,
          notify: true,
        },

        /** The headers of the request. */
        headers: {
          type: Object,
          value: null,
        },

        /**
         * The `content enricher` of the resource.
         * Can be an object with entity type as keys or list or string with the entity type defined by
         * `enrichers-entity`.
         */
        enrichers: {
          type: Object,
          value: {},
        },

        /** The `content enricher` entity-type of the resource. Default value for Nuxeo Document Model */
        enrichersEntity: {
          type: String,
          value: 'document',
        },

        /**
         * List of comma separated values of the document schemas to be returned.
         * All document schemas are returned by default.
         */
        schemas: {
          type: String,
          value: '',
        },

        /**
         * Active request count.
         */
        activeRequests: {
          type: Number,
          value: 0,
          notify: true,
          readOnly: true,
        },

        /**
         * If true, documents changed by the call will be reindexed synchronously server side.
         */
        syncIndexing: Boolean,

        /**
         * True while requests are in flight.
         */
        loading: {
          type: Boolean,
          notify: true,
          readOnly: true,
        },

        /**
         * If true, execute the operation asynchronously.
         */
        async: {
          type: Boolean,
          value: false,
        },

        /**
         * Poll interval in ms.
         */
        pollInterval: {
          type: Number,
          value: 1000,
        },
      };
    }

    static get observers() {
      return ['_autoExecute(op, params, enrichers, enrichersEntity)', '_isLoading(activeRequests)'];
    }

    /**
     * Fired when the operation returns with no errors.
     *
     * @event response
     */
    execute() {
      this._setActiveRequests(this.activeRequests + 1);

      let params = !this.params || typeof this.params === 'object' ? this.params : JSON.parse(this.params);

      let { input } = this;

      let { op } = this;

      // the goal is to track if we have a bulk action in select all mode (to be used for the abort method)
      let isBulk = false;

      if (this._isPageProvider(input) || this._isView(input)) {
        let pageProvider;
        // support page provider as input to operations
        // relies on parameters naming convention until provider marshaller is available
        if (this._isPageProvider(input)) {
          pageProvider = input;
          input = undefined;
        } else if (this._isSelectAllActive(input)) {
          // in select all mode, we use `Bulk.RunAction` as the operation and `this.op` as a parameter for it
          op = 'Bulk.RunAction';
          // support page provider display behavior instances (table, grid, list) as input to operations for select all
          pageProvider = input.nxProvider;
          params = {
            action: 'automationUi',
            providerName: pageProvider.provider,
            parameters: JSON.stringify({
              operationId: this.op,
              parameters: params,
            }),
          };
          isBulk = true;
          input = undefined;
        } else {
          // only a few selected documents should be considered for the operation
          pageProvider = input.nxProvider;
          input = input.selectedItems;
        }

        params.providerName = pageProvider.provider;
        Object.assign(params, pageProvider._params);
        // ELEMENTS-1318 - commas would need to be escaped, as queryParams are mapped to stringlists by the server
        // But passing queryParams as an array will map directly to the server stringlist
        if (params.queryParams && !Array.isArray(params.queryParams)) {
          params.queryParams = [params.queryParams];
        } else if (!params.queryParams) {
          params.queryParams = [];
        }
      }

      const options = {};
      // Look up document schemas to be returned
      if (this.schemas && this.schemas.length > 1) {
        options.schemas = this.schemas.trim().split(/[\s,]+/);
      }
      options.headers = this.headers || {};
      // Force sync indexing
      if (this.syncIndexing) {
        options.headers['nx-es-sync'] = true;
      }
      // Look up content enrichers parameter
      if (this.enrichers) {
        let enrich = {};
        if (typeof this.enrichers === 'string') {
          enrich[this.enrichersEntity] = this.enrichers;
        } else {
          enrich = this.enrichers;
        }
        Object.entries(enrich).forEach(([type, value]) => {
          let v = value;
          if (Array.isArray(value)) {
            v = value.join(',');
          }
          options.headers[`enrichers-${type}`] = v;
        });
      }

      // Manage the way to abort the request
      if (!this.uncancelable) {
        if (this._controller) {
          this._controller.abort();
        }

        // For the next request
        this._controller = new AbortController();
        options.signal = this._controller.signal;
      }

      return this.$.nx.operation(op).then((operation) => {
        this._operation = operation;
        return this._doExecute(input, params, options, isBulk);
      });
    }

    _isPageProvider(input) {
      return Nuxeo.PageProvider && input instanceof Nuxeo.PageProvider;
    }

    _isView(input) {
      return input && input.nxProvider && 'selectedItems' in input && 'selectAllEnabled' in input;
    }

    _isSelectAllActive(input) {
      return this._isView(input) && input.selectAllActive;
    }

    _autoExecute() {
      if (this.auto) {
        this.execute();
      }
    }

    _doExecute(input, params, options, isBulk) {
      if (params.context) {
        this._operation = this._operation.context(params.context);
      }

      if (this.async) {
        options.url = `${this._operation._computeRequestURL()}/@async`;
        options.resolveWithFullResponse = true;
      }

      let promise = this._operation
        .params(params)
        .input(input)
        .execute(options);

      if (this.async && !isBulk) {
        promise = promise.then((res) => {
          if (res.status === 202) {
            this.dispatchEvent(
              new CustomEvent('poll-start', {
                bubbles: true,
                composed: true,
              }),
            );
            return this._poll(res.headers.get('location'));
          }
          return res;
        });
      }

      // if this is running with the BAF, then we need to poll using a different endpoint
      if (isBulk) {
        promise = promise.then((res) => {
          if (this._isRunning(res)) {
            const status = res.value;
            this.dispatchEvent(
              new CustomEvent('poll-start', {
                bubbles: true,
                composed: true,
                detail: status,
              }),
            );
            return (
              this.$.nx
                .request()
                .then((request) => this._poll(`${request._url}bulk/${status.commandId}`))
                /*
                 * XXX: Bulk command has completed, but other triggered actions, like indexing could still be running.
                 * As a temporary solution and until `NXP-30502 is done, the goal is to use a timeout and wait for ES
                 * to finish indexing.
                 */
                .then((pollRes) =>
                  this.$.nx
                    .operation('Elasticsearch.WaitForIndexing')
                    .then((op) =>
                      op
                        .params({ timeoutSecond: 5, refresh: true })
                        .execute()
                        .then(() => pollRes),
                    )
                    .catch(() => pollRes),
                )
            );
          }
          return res;
        });
      }

      return promise
        .then((data) => {
          this.dispatchEvent(
            new CustomEvent('response', {
              bubbles: true,
              composed: true,
              detail: {
                response: data,
              },
            }),
          );
          this.response = data;
          this.success = true;
          this._setActiveRequests(this.activeRequests - 1);
          return this.response;
        })
        .catch((error) => {
          if (error.response && error.response.status === 401) {
            this.dispatchEvent(
              new CustomEvent('unauthorized-request', {
                bubbles: true,
                composed: true,
                detail: error,
              }),
            );
          }
          this.success = false;
          this.error = error;
          console.warn(`Operation request failed: ${error}`);
          this._setActiveRequests(this.activeRequests - 1);
          throw this.error;
        });
    }

    /**
     * Handler to abort bulk operations executed through the BAF
     */
    _abort(commandId) {
      // if the operation is aborted, then on next poll we get the correct state
      return this.$.nx.request().then((request) =>
        request
          .path(`bulk/${commandId}/abort`)
          .execute({ method: 'put' })
          .then((status) => {
            if (this._isAborted(status)) {
              this.dispatchEvent(
                new CustomEvent('poll-aborted', {
                  bubbles: true,
                  composed: true,
                  detail: status,
                }),
              );
            } else {
              console.warn(`Incorrect abort status on bulk action: ${status}`);
            }
            return status;
          })
          .catch((error) => {
            this.dispatchEvent(
              new CustomEvent('poll-error', {
                bubbles: true,
                composed: true,
                detail: error,
              }),
            );
            console.warn(`Bulk action abort failed: ${error}`);
            throw error;
          }),
      );
    }

    _isRunning(status) {
      if (status['entity-type'] === 'bulkStatus') {
        const { state } = status.value || status;
        return state !== 'ABORTED' && state !== 'COMPLETED';
      }
      return status === 'RUNNING';
    }

    _isAborted(status) {
      if (status['entity-type'] === 'bulkStatus') {
        const { state } = status.value || status;
        return state === 'ABORTED';
      }
      return this._isRunning(status);
    }

    _poll(url) {
      return new Promise((resolve, reject) => {
        const fn = () => {
          this.$.nx
            .http(url)
            .then((res) => {
              if (this._isRunning(res)) {
                this.dispatchEvent(
                  new CustomEvent('poll-update', {
                    bubbles: true,
                    composed: true,
                    detail: res,
                  }),
                );
                window.setTimeout(() => fn(), this.pollInterval, url);
              } else if (res.error) {
                // if in bulk mode we had errors, we need to call reject instead
                reject(res);
              } else {
                resolve(res);
              }
            })
            .catch((error) => {
              this.dispatchEvent(
                new CustomEvent('poll-error', {
                  bubbles: true,
                  composed: true,
                  detail: error,
                }),
              );
              reject(error);
            });
        };
        fn();
      });
    }

    _isLoading() {
      this._setLoading(this.activeRequests > 0);
    }
  }

  customElements.define(Operation.is, Operation);
  Nuxeo.Operation = Operation;
}
