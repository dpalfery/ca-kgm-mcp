# Domain Layer Business Rules and Entity Management

## Metadata
- **Layer**: 3-Domain
- **AuthoritativeFor**: [business-rules, domain-modeling, entities, value-objects, aggregates]
- **Topics**: [DDD, entities, value-objects, domain-services, business-logic, invariants, events]

## When to Apply
- Implementing domain entities and value objects
- Creating business rule validation
- Designing aggregate boundaries
- Implementing domain services
- Managing domain events and business processes

## Directives

### Entity Design and Invariants

**MUST** Ensure all business invariants are enforced within domain entities.

**Rationale**: Domain entities are responsible for maintaining their own consistency and enforcing business rules. This prevents invalid states and ensures data integrity at the domain level.

**Example**:
```typescript
export class BankAccount {
  private constructor(
    private readonly _id: AccountId,
    private readonly _customerId: CustomerId,
    private _balance: Money,
    private _status: AccountStatus,
    private readonly _createdAt: Date
  ) {
    this.validateInvariants();
  }

  static create(customerId: CustomerId, initialDeposit: Money): BankAccount {
    if (initialDeposit.amount < 0) {
      throw new DomainError('Initial deposit cannot be negative');
    }
    
    if (initialDeposit.amount < 100) {
      throw new DomainError('Minimum initial deposit is $100');
    }

    return new BankAccount(
      AccountId.generate(),
      customerId,
      initialDeposit,
      AccountStatus.ACTIVE,
      new Date()
    );
  }

  withdraw(amount: Money): void {
    if (this._status !== AccountStatus.ACTIVE) {
      throw new DomainError('Cannot withdraw from inactive account');
    }

    if (amount.amount <= 0) {
      throw new DomainError('Withdrawal amount must be positive');
    }

    const newBalance = this._balance.subtract(amount);
    if (newBalance.amount < 0) {
      throw new DomainError('Insufficient funds');
    }

    // Business rule: Minimum balance requirement
    if (newBalance.amount < 10) {
      throw new DomainError('Account must maintain minimum balance of $10');
    }

    this._balance = newBalance;
    this.validateInvariants();
  }

  deposit(amount: Money): void {
    if (this._status !== AccountStatus.ACTIVE) {
      throw new DomainError('Cannot deposit to inactive account');
    }

    if (amount.amount <= 0) {
      throw new DomainError('Deposit amount must be positive');
    }

    // Business rule: Maximum daily deposit limit
    const maxDailyDeposit = new Money(10000, this._balance.currency);
    if (amount.amount > maxDailyDeposit.amount) {
      throw new DomainError('Deposit exceeds daily limit of $10,000');
    }

    this._balance = this._balance.add(amount);
    this.validateInvariants();
  }

  private validateInvariants(): void {
    if (this._balance.amount < 0) {
      throw new DomainError('Account balance cannot be negative');
    }

    if (this._status === AccountStatus.ACTIVE && this._balance.amount < 10) {
      throw new DomainError('Active account must maintain minimum balance');
    }
  }

  get id(): AccountId { return this._id; }
  get balance(): Money { return this._balance; }
  get status(): AccountStatus { return this._status; }
}
```

**Anti-pattern**:
```typescript
// NEVER do this - anemic domain model
export class BankAccount {
  public id: string;
  public customerId: string;
  public balance: number;
  public status: string;
  
  // No business logic, just data
}

// Business logic scattered in services
export class BankAccountService {
  withdraw(account: BankAccount, amount: number) {
    // Business rules implemented outside the entity
    if (account.balance < amount) {
      throw new Error('Insufficient funds');
    }
    account.balance -= amount;
  }
}
```

**MUST** Use value objects for domain concepts that have no identity.

**Rationale**: Value objects encapsulate validation logic, provide type safety, and make the domain model more expressive and less error-prone.

**Example**:
```typescript
export class Money {
  private readonly _amount: number;
  private readonly _currency: Currency;

  constructor(amount: number, currency: Currency) {
    if (amount < 0) {
      throw new DomainError('Money amount cannot be negative');
    }
    
    if (!Number.isFinite(amount)) {
      throw new DomainError('Money amount must be a finite number');
    }

    // Round to currency precision (e.g., 2 decimal places for USD)
    this._amount = Math.round(amount * 100) / 100;
    this._currency = currency;
  }

  add(other: Money): Money {
    if (!this._currency.equals(other._currency)) {
      throw new DomainError('Cannot add money with different currencies');
    }
    return new Money(this._amount + other._amount, this._currency);
  }

  subtract(other: Money): Money {
    if (!this._currency.equals(other._currency)) {
      throw new DomainError('Cannot subtract money with different currencies');
    }
    return new Money(this._amount - other._amount, this._currency);
  }

  multiply(factor: number): Money {
    if (!Number.isFinite(factor)) {
      throw new DomainError('Multiplication factor must be finite');
    }
    return new Money(this._amount * factor, this._currency);
  }

  equals(other: Money): boolean {
    return this._amount === other._amount && 
           this._currency.equals(other._currency);
  }

  isGreaterThan(other: Money): boolean {
    if (!this._currency.equals(other._currency)) {
      throw new DomainError('Cannot compare money with different currencies');
    }
    return this._amount > other._amount;
  }

  get amount(): number { return this._amount; }
  get currency(): Currency { return this._currency; }

  toString(): string {
    return `${this._currency.symbol}${this._amount.toFixed(2)}`;
  }
}

export class Email {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || value.trim().length === 0) {
      throw new DomainError('Email cannot be empty');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      throw new DomainError('Invalid email format');
    }

    if (value.length > 254) {
      throw new DomainError('Email address too long');
    }

    this._value = value.toLowerCase().trim();
  }

  equals(other: Email): boolean {
    return this._value === other._value;
  }

  get value(): string { return this._value; }
  get domain(): string { 
    return this._value.split('@')[1]; 
  }

  toString(): string { return this._value; }
}
```

### Aggregate Design

**MUST** Design aggregates to maintain consistency boundaries.

**Rationale**: Aggregates ensure transactional consistency within their boundaries while allowing eventual consistency between aggregates.

**Example**:
```typescript
export class Order {
  private constructor(
    private readonly _id: OrderId,
    private readonly _customerId: CustomerId,
    private _items: OrderItem[],
    private _status: OrderStatus,
    private _shippingAddress: Address,
    private readonly _createdAt: Date,
    private _updatedAt: Date
  ) {}

  static create(
    customerId: CustomerId, 
    shippingAddress: Address
  ): Order {
    return new Order(
      OrderId.generate(),
      customerId,
      [],
      OrderStatus.DRAFT,
      shippingAddress,
      new Date(),
      new Date()
    );
  }

  addItem(productId: ProductId, quantity: number, unitPrice: Money): void {
    if (this._status !== OrderStatus.DRAFT) {
      throw new DomainError('Cannot modify confirmed order');
    }

    if (quantity <= 0) {
      throw new DomainError('Quantity must be positive');
    }

    // Business rule: Maximum 10 items per order
    if (this._items.length >= 10) {
      throw new DomainError('Order cannot have more than 10 items');
    }

    // Check if item already exists
    const existingItem = this._items.find(item => 
      item.productId.equals(productId)
    );

    if (existingItem) {
      existingItem.updateQuantity(existingItem.quantity + quantity);
    } else {
      const orderItem = OrderItem.create(productId, quantity, unitPrice);
      this._items.push(orderItem);
    }

    this._updatedAt = new Date();
  }

  removeItem(productId: ProductId): void {
    if (this._status !== OrderStatus.DRAFT) {
      throw new DomainError('Cannot modify confirmed order');
    }

    const itemIndex = this._items.findIndex(item => 
      item.productId.equals(productId)
    );

    if (itemIndex === -1) {
      throw new DomainError('Item not found in order');
    }

    this._items.splice(itemIndex, 1);
    this._updatedAt = new Date();
  }

  confirm(): OrderConfirmedEvent {
    if (this._status !== OrderStatus.DRAFT) {
      throw new DomainError('Order is already confirmed');
    }

    if (this._items.length === 0) {
      throw new DomainError('Cannot confirm empty order');
    }

    // Business rule: Minimum order value
    const totalValue = this.calculateTotal();
    const minimumOrderValue = new Money(25, totalValue.currency);
    if (totalValue.amount < minimumOrderValue.amount) {
      throw new DomainError('Order must be at least $25');
    }

    this._status = OrderStatus.CONFIRMED;
    this._updatedAt = new Date();

    // Return domain event
    return new OrderConfirmedEvent(
      this._id,
      this._customerId,
      totalValue,
      this._items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice
      }))
    );
  }

  private calculateTotal(): Money {
    if (this._items.length === 0) {
      return new Money(0, Currency.USD);
    }

    return this._items.reduce(
      (total, item) => total.add(item.totalPrice),
      new Money(0, this._items[0].unitPrice.currency)
    );
  }

  get id(): OrderId { return this._id; }
  get customerId(): CustomerId { return this._customerId; }
  get items(): readonly OrderItem[] { return [...this._items]; }
  get status(): OrderStatus { return this._status; }
  get total(): Money { return this.calculateTotal(); }
}

export class OrderItem {
  private constructor(
    private readonly _productId: ProductId,
    private _quantity: number,
    private readonly _unitPrice: Money
  ) {}

  static create(
    productId: ProductId, 
    quantity: number, 
    unitPrice: Money
  ): OrderItem {
    if (quantity <= 0) {
      throw new DomainError('Quantity must be positive');
    }

    if (unitPrice.amount <= 0) {
      throw new DomainError('Unit price must be positive');
    }

    return new OrderItem(productId, quantity, unitPrice);
  }

  updateQuantity(newQuantity: number): void {
    if (newQuantity <= 0) {
      throw new DomainError('Quantity must be positive');
    }

    // Business rule: Maximum quantity per item
    if (newQuantity > 100) {
      throw new DomainError('Maximum quantity per item is 100');
    }

    this._quantity = newQuantity;
  }

  get productId(): ProductId { return this._productId; }
  get quantity(): number { return this._quantity; }
  get unitPrice(): Money { return this._unitPrice; }
  get totalPrice(): Money { 
    return this._unitPrice.multiply(this._quantity); 
  }
}
```

### Domain Services

**SHOULD** Use domain services for business logic that doesn't naturally fit in entities.

**Rationale**: Some business operations involve multiple entities or external concerns. Domain services encapsulate this logic while keeping it in the domain layer.

**Example**:
```typescript
export class TransferService {
  constructor(
    private accountRepository: AccountRepository,
    private transferLimitPolicy: TransferLimitPolicy
  ) {}

  async transfer(
    fromAccountId: AccountId,
    toAccountId: AccountId,
    amount: Money
  ): Promise<TransferCompletedEvent> {
    // Load aggregates
    const fromAccount = await this.accountRepository.findById(fromAccountId);
    const toAccount = await this.accountRepository.findById(toAccountId);

    if (!fromAccount) {
      throw new DomainError('Source account not found');
    }

    if (!toAccount) {
      throw new DomainError('Destination account not found');
    }

    // Business rule: Cannot transfer to same account
    if (fromAccount.id.equals(toAccount.id)) {
      throw new DomainError('Cannot transfer to the same account');
    }

    // Business rule: Check transfer limits
    if (!this.transferLimitPolicy.isWithinLimit(fromAccount, amount)) {
      throw new DomainError('Transfer exceeds daily limit');
    }

    // Business rule: Validate currency compatibility
    if (!fromAccount.balance.currency.equals(amount.currency)) {
      throw new DomainError('Currency mismatch');
    }

    // Perform the transfer
    fromAccount.withdraw(amount);
    toAccount.deposit(amount);

    // Save both aggregates
    await this.accountRepository.save(fromAccount);
    await this.accountRepository.save(toAccount);

    // Return domain event
    return new TransferCompletedEvent(
      TransferId.generate(),
      fromAccountId,
      toAccountId,
      amount,
      new Date()
    );
  }
}

export class TransferLimitPolicy {
  private readonly dailyLimit = new Money(5000, Currency.USD);

  async isWithinLimit(account: BankAccount, amount: Money): Promise<boolean> {
    // This would typically check against a repository of recent transfers
    const todayTransfers = await this.getTodayTransfers(account.id);
    const totalToday = todayTransfers.reduce(
      (sum, transfer) => sum.add(transfer.amount),
      new Money(0, amount.currency)
    );

    return totalToday.add(amount).amount <= this.dailyLimit.amount;
  }

  private async getTodayTransfers(accountId: AccountId): Promise<Transfer[]> {
    // Implementation would query transfer repository
    return [];
  }
}
```

### Domain Events

**SHOULD** Use domain events to communicate between bounded contexts.

**Rationale**: Domain events provide loose coupling between aggregates and enable eventual consistency across bounded contexts.

**Example**:
```typescript
export abstract class DomainEvent {
  public readonly occurredOn: Date;
  public readonly eventId: string;

  constructor() {
    this.occurredOn = new Date();
    this.eventId = crypto.randomUUID();
  }

  abstract get eventType(): string;
}

export class OrderConfirmedEvent extends DomainEvent {
  constructor(
    public readonly orderId: OrderId,
    public readonly customerId: CustomerId,
    public readonly totalAmount: Money,
    public readonly items: Array<{
      productId: ProductId;
      quantity: number;
      unitPrice: Money;
    }>
  ) {
    super();
  }

  get eventType(): string {
    return 'OrderConfirmed';
  }
}

export class CustomerRegisteredEvent extends DomainEvent {
  constructor(
    public readonly customerId: CustomerId,
    public readonly email: Email,
    public readonly name: string
  ) {
    super();
  }

  get eventType(): string {
    return 'CustomerRegistered';
  }
}

// Event publisher interface
export interface DomainEventPublisher {
  publish(event: DomainEvent): Promise<void>;
  publishAll(events: DomainEvent[]): Promise<void>;
}

// Aggregate base class with event support
export abstract class AggregateRoot {
  private _domainEvents: DomainEvent[] = [];

  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  get domainEvents(): readonly DomainEvent[] {
    return [...this._domainEvents];
  }

  clearDomainEvents(): void {
    this._domainEvents = [];
  }
}

// Enhanced Order aggregate with events
export class Order extends AggregateRoot {
  // ... previous implementation ...

  confirm(): void {
    if (this._status !== OrderStatus.DRAFT) {
      throw new DomainError('Order is already confirmed');
    }

    // ... validation logic ...

    this._status = OrderStatus.CONFIRMED;
    this._updatedAt = new Date();

    // Add domain event
    this.addDomainEvent(new OrderConfirmedEvent(
      this._id,
      this._customerId,
      this.calculateTotal(),
      this._items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice
      }))
    ));
  }
}

// Repository with event publishing
export class OrderRepository {
  constructor(
    private database: Database,
    private eventPublisher: DomainEventPublisher
  ) {}

  async save(order: Order): Promise<void> {
    // Save aggregate
    await this.database.save(order);

    // Publish domain events
    const events = order.domainEvents;
    if (events.length > 0) {
      await this.eventPublisher.publishAll(events);
      order.clearDomainEvents();
    }
  }
}
```

**MAY** Implement specification pattern for complex business rules.

**Rationale**: Specifications make complex business rules more readable, testable, and reusable.

**Example**:
```typescript
export abstract class Specification<T> {
  abstract isSatisfiedBy(candidate: T): boolean;

  and(other: Specification<T>): Specification<T> {
    return new AndSpecification(this, other);
  }

  or(other: Specification<T>): Specification<T> {
    return new OrSpecification(this, other);
  }

  not(): Specification<T> {
    return new NotSpecification(this);
  }
}

class AndSpecification<T> extends Specification<T> {
  constructor(
    private left: Specification<T>,
    private right: Specification<T>
  ) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return this.left.isSatisfiedBy(candidate) && 
           this.right.isSatisfiedBy(candidate);
  }
}

// Business rule specifications
export class EligibleForPremiumAccountSpecification extends Specification<Customer> {
  isSatisfiedBy(customer: Customer): boolean {
    return customer.accountAge.years >= 2 &&
           customer.averageMonthlyBalance.amount >= 10000 &&
           customer.creditScore >= 750;
  }
}

export class EligibleForLoanSpecification extends Specification<Customer> {
  isSatisfiedBy(customer: Customer): boolean {
    return customer.monthlyIncome.amount >= 3000 &&
           customer.creditScore >= 650 &&
           customer.hasNoDefaultHistory();
  }
}

// Usage in domain service
export class CustomerService {
  private premiumEligibility = new EligibleForPremiumAccountSpecification();
  private loanEligibility = new EligibleForLoanSpecification();

  canUpgradeToPremium(customer: Customer): boolean {
    return this.premiumEligibility.isSatisfiedBy(customer);
  }

  canApplyForLoan(customer: Customer): boolean {
    return this.loanEligibility.isSatisfiedBy(customer);
  }

  canApplyForPremiumLoan(customer: Customer): boolean {
    const premiumLoanEligibility = this.premiumEligibility.and(this.loanEligibility);
    return premiumLoanEligibility.isSatisfiedBy(customer);
  }
}
```