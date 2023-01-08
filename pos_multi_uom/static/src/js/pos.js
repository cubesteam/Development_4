odoo.define('pos_multi_uom.pos_multi_uom', function (require) {
"use strict";

const PosComponent = require('point_of_sale.PosComponent');
const ProductScreen = require('point_of_sale.ProductScreen');
const { useListener } = require('web.custom_hooks');
const Registries = require('point_of_sale.Registries');
const models = require('point_of_sale.models');
const { useState, useRef } = owl.hooks;
const AbstractAwaitablePopup = require('point_of_sale.AbstractAwaitablePopup');

models.load_fields('product.product',['has_multi_uom','multi_uom_ids']);

models.load_models([{
    model: 'product.multi.uom',
    condition: function(self){ return self.config.allow_multi_uom; },
    fields: ['multi_uom_id','price'],
    loaded: function(self,result){
        if(result.length){
            self.wv_uom_list = result;
        }
        else{
            self.wv_uom_list = [];
        }
    },
    }],{'after': 'product.product'});

    class MulitUOMWidget extends AbstractAwaitablePopup {
        multi_uom_button(event){
            // const value = $(event.target).html();
            var uom_id = $(event.target).data('uom_id');
            var price = $(event.target).data('price');
            var line = this.env.pos.get_order().get_selected_orderline();
            if(line){
                line.set_unit_price(price);
                line.set_product_uom(uom_id);
                line.price_manually_set = true;
            }
            this.cancel();
        }
    }
    MulitUOMWidget.template = 'MulitUOMWidget';
    MulitUOMWidget.defaultProps = {
        confirmText: 'Ok',
        cancelText: 'Cancel',
        title: '',
        body: '',
    };

    Registries.Component.add(MulitUOMWidget);

    class ChangeUOMButton extends PosComponent {
        constructor() {
            super(...arguments);
            useListener('click', this.onClick);
        }
        get selectedOrderline() {
            return this.env.pos.get_order().get_selected_orderline();
        }
        async onClick() {
            if (!this.selectedOrderline) return;
            var modifiers_list = [];
            var product = this.selectedOrderline.get_product();
            var wv_uom_list = this.env.pos.wv_uom_list;
            var multi_uom_ids = product.multi_uom_ids;
            for(var i=0;i<wv_uom_list.length;i++){
                if(multi_uom_ids.indexOf(wv_uom_list[i].id)>=0){
                    modifiers_list.push(wv_uom_list[i]);
                }
            }
            await this.showPopup('MulitUOMWidget', {
                title: this.env._t(' POS Multi UOM '),
                modifiers_list:modifiers_list,
            });
        }
    }
    ChangeUOMButton.template = 'ChangeUOMButton';

    ProductScreen.addControlButton({
        component: ChangeUOMButton,
        condition: function() {
            return this.env.pos.config.allow_multi_uom;
        },
    });

    Registries.Component.add(ChangeUOMButton);


    var _super_orderline = models.Orderline.prototype;
    models.Orderline = models.Orderline.extend({
        initialize: function(attr, options) {
            _super_orderline.initialize.call(this,attr,options);
            this.wvproduct_uom = '';
        },
        set_product_uom: function(uom_id){
            this.wvproduct_uom = this.pos.units_by_id[uom_id];
            this.trigger('change',this);
        },

        get_unit: function(){
            var unit_id = this.product.uom_id;
            if(!unit_id){
                return undefined;
            }
            unit_id = unit_id[0];
            if(!this.pos){
                return undefined;
            }
            return this.wvproduct_uom == '' ? this.pos.units_by_id[unit_id] : this.wvproduct_uom;
        },

        export_as_JSON: function(){
            var unit_id = this.product.uom_id;
            var json = _super_orderline.export_as_JSON.call(this);
            json.product_uom = this.wvproduct_uom == '' ? unit_id[0] : this.wvproduct_uom.id;
            return json;
        },
        init_from_JSON: function(json){
            _super_orderline.init_from_JSON.apply(this,arguments);
            this.wvproduct_uom = json.wvproduct_uom;
        },

    });

});

