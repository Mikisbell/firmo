"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Truck, ShoppingBag, Phone, MapPin, User, Clock, Banknote, CreditCard } from "lucide-react";

export type OrderType = "TAKEOUT" | "DELIVERY";
export type PaymentExpectation = "PREPAID" | "COD";

export interface NewOrderData {
    order_type: OrderType;
    // Customer info
    customer_name: string;
    customer_phone: string;
    // Delivery specific
    delivery_address?: string;
    delivery_reference?: string;
    delivery_fee_cents?: number;
    // Payment
    payment_expectation: PaymentExpectation;
    // Pickup specific
    pickup_time_mins?: number; // Minutes from now
    // Notes
    notes?: string;
}

interface NewOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (data: NewOrderData) => void;
    defaultDeliveryFee?: number; // in cents
}

export function NewOrderModal({ isOpen, onClose, onConfirm, defaultDeliveryFee = 600 }: NewOrderModalProps) {
    const [orderType, setOrderType] = useState<OrderType>("TAKEOUT");
    const [customerName, setCustomerName] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");
    const [deliveryAddress, setDeliveryAddress] = useState("");
    const [deliveryReference, setDeliveryReference] = useState("");
    const [deliveryFee, setDeliveryFee] = useState(defaultDeliveryFee);
    const [paymentExpectation, setPaymentExpectation] = useState<PaymentExpectation>("PREPAID");
    const [pickupTimeMins, setPickupTimeMins] = useState(20);
    const [notes, setNotes] = useState("");

    const resetForm = () => {
        setOrderType("TAKEOUT");
        setCustomerName("");
        setCustomerPhone("");
        setDeliveryAddress("");
        setDeliveryReference("");
        setDeliveryFee(defaultDeliveryFee);
        setPaymentExpectation("PREPAID");
        setPickupTimeMins(20);
        setNotes("");
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const handleConfirm = () => {
        const data: NewOrderData = {
            order_type: orderType,
            customer_name: customerName.trim(),
            customer_phone: customerPhone.trim(),
            payment_expectation: paymentExpectation,
        };

        if (orderType === "DELIVERY") {
            data.delivery_address = deliveryAddress.trim();
            data.delivery_reference = deliveryReference.trim() || undefined;
            data.delivery_fee_cents = deliveryFee;
        } else {
            data.pickup_time_mins = pickupTimeMins;
        }

        if (notes.trim()) {
            data.notes = notes.trim();
        }

        onConfirm(data);
        handleClose();
    };

    const isValid = customerName.trim().length >= 2 && 
        customerPhone.trim().length >= 7 &&
        (orderType === "TAKEOUT" || deliveryAddress.trim().length >= 5);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                onClick={handleClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden border border-zinc-800"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                        <h2 className="text-lg font-bold text-white">Nuevo Pedido</h2>
                        <button
                            onClick={handleClose}
                            className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                        {/* Order Type Selector */}
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setOrderType("TAKEOUT")}
                                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                                    orderType === "TAKEOUT"
                                        ? "border-indigo-500 bg-indigo-500/10"
                                        : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-600"
                                }`}
                            >
                                <ShoppingBag size={28} className={orderType === "TAKEOUT" ? "text-indigo-400" : "text-zinc-400"} />
                                <span className={`font-medium ${orderType === "TAKEOUT" ? "text-white" : "text-zinc-400"}`}>
                                    Para Llevar
                                </span>
                            </button>
                            <button
                                onClick={() => setOrderType("DELIVERY")}
                                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                                    orderType === "DELIVERY"
                                        ? "border-indigo-500 bg-indigo-500/10"
                                        : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-600"
                                }`}
                            >
                                <Truck size={28} className={orderType === "DELIVERY" ? "text-indigo-400" : "text-zinc-400"} />
                                <span className={`font-medium ${orderType === "DELIVERY" ? "text-white" : "text-zinc-400"}`}>
                                    Delivery
                                </span>
                            </button>
                        </div>

                        {/* Customer Info */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-medium text-zinc-400">Datos del Cliente</h3>
                            
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                <input
                                    type="text"
                                    placeholder="Nombre del cliente *"
                                    value={customerName}
                                    onChange={(e) => setCustomerName(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                <input
                                    type="tel"
                                    placeholder="Teléfono *"
                                    value={customerPhone}
                                    onChange={(e) => setCustomerPhone(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </div>

                        {/* Delivery Address (only for DELIVERY) */}
                        {orderType === "DELIVERY" && (
                            <div className="space-y-3">
                                <h3 className="text-sm font-medium text-zinc-400">Dirección de Entrega</h3>
                                
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
                                    <textarea
                                        placeholder="Dirección completa *"
                                        value={deliveryAddress}
                                        onChange={(e) => setDeliveryAddress(e.target.value)}
                                        rows={2}
                                        className="w-full pl-10 pr-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                    />
                                </div>

                                <input
                                    type="text"
                                    placeholder="Referencia (opcional)"
                                    value={deliveryReference}
                                    onChange={(e) => setDeliveryReference(e.target.value)}
                                    className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />

                                {/* Delivery Fee */}
                                <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-xl border border-zinc-700">
                                    <span className="text-sm text-zinc-400">Costo de delivery</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-zinc-500">S/</span>
                                        <input
                                            type="number"
                                            value={(deliveryFee / 100).toFixed(2)}
                                            onChange={(e) => setDeliveryFee(Math.round(parseFloat(e.target.value || "0") * 100))}
                                            step="0.50"
                                            min="0"
                                            className="w-20 px-2 py-1 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-right focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Pickup Time (only for TAKEOUT) */}
                        {orderType === "TAKEOUT" && (
                            <div className="space-y-3">
                                <h3 className="text-sm font-medium text-zinc-400">Tiempo de Recojo</h3>
                                <div className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-xl border border-zinc-700">
                                    <Clock className="w-5 h-5 text-zinc-500" />
                                    <span className="text-zinc-400">Listo en</span>
                                    <select
                                        value={pickupTimeMins}
                                        onChange={(e) => setPickupTimeMins(parseInt(e.target.value))}
                                        className="flex-1 px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value={10}>10 minutos</option>
                                        <option value={15}>15 minutos</option>
                                        <option value={20}>20 minutos</option>
                                        <option value={30}>30 minutos</option>
                                        <option value={45}>45 minutos</option>
                                        <option value={60}>1 hora</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* Payment Expectation */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-medium text-zinc-400">Forma de Pago</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setPaymentExpectation("PREPAID")}
                                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                                        paymentExpectation === "PREPAID"
                                            ? "border-emerald-500 bg-emerald-500/10"
                                            : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-600"
                                    }`}
                                >
                                    <CreditCard size={18} className={paymentExpectation === "PREPAID" ? "text-emerald-400" : "text-zinc-400"} />
                                    <span className={`text-sm font-medium ${paymentExpectation === "PREPAID" ? "text-white" : "text-zinc-400"}`}>
                                        Pago Anticipado
                                    </span>
                                </button>
                                <button
                                    onClick={() => setPaymentExpectation("COD")}
                                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                                        paymentExpectation === "COD"
                                            ? "border-yellow-500 bg-yellow-500/10"
                                            : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-600"
                                    }`}
                                >
                                    <Banknote size={18} className={paymentExpectation === "COD" ? "text-yellow-400" : "text-zinc-400"} />
                                    <span className={`text-sm font-medium ${paymentExpectation === "COD" ? "text-white" : "text-zinc-400"}`}>
                                        Contra-entrega
                                    </span>
                                </button>
                            </div>
                        </div>

                        {/* Notes */}
                        <div className="space-y-2">
                            <h3 className="text-sm font-medium text-zinc-400">Notas (opcional)</h3>
                            <textarea
                                placeholder="Instrucciones especiales, alergias, etc."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={2}
                                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                            />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex gap-3 p-4 border-t border-zinc-800 bg-zinc-900/50">
                        <button
                            onClick={handleClose}
                            className="flex-1 py-3 px-4 rounded-xl bg-zinc-800 text-zinc-300 font-medium hover:bg-zinc-700 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={!isValid}
                            className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all ${
                                isValid
                                    ? "bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-500/20"
                                    : "bg-zinc-700 text-zinc-500 cursor-not-allowed"
                            }`}
                        >
                            Crear Pedido
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
