# Presentation Layer Security and UX Rules

## Metadata
- **Layer**: 1-Presentation
- **AuthoritativeFor**: [security, user-experience, accessibility, performance]
- **Topics**: [React, UI, components, forms, validation, XSS, CSRF, accessibility]

## When to Apply
- Creating React components
- Building user interfaces
- Handling user input and forms
- Implementing client-side validation
- Managing authentication flows in the UI

## Directives

### Input Validation and Sanitization

**MUST** Sanitize all user input before displaying it in the UI to prevent XSS attacks.

**Rationale**: Cross-site scripting (XSS) vulnerabilities can allow attackers to execute malicious scripts in users' browsers, potentially stealing sensitive information or performing unauthorized actions.

**Example**:
```jsx
// Correct: Using React's built-in XSS protection
function UserProfile({ userName }) {
  return <div>Welcome, {userName}</div>; // React automatically escapes
}

// For HTML content, use DOMPurify
import DOMPurify from 'dompurify';
function RichContent({ htmlContent }) {
  return (
    <div 
      dangerouslySetInnerHTML={{
        __html: DOMPurify.sanitize(htmlContent)
      }} 
    />
  );
}
```

**Anti-pattern**:
```jsx
// NEVER do this - vulnerable to XSS
function UnsafeContent({ userContent }) {
  return <div dangerouslySetInnerHTML={{__html: userContent}} />;
}
```

**MUST** Validate form inputs on both client and server sides.

**Rationale**: Client-side validation provides immediate feedback to users, while server-side validation ensures security since client-side validation can be bypassed.

**Example**:
```jsx
function LoginForm() {
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState({});

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Client-side validation
    const newErrors = {};
    if (!validateEmail(email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Submit to server (which will also validate)
    try {
      await submitLogin({ email });
    } catch (serverError) {
      setErrors({ server: serverError.message });
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        aria-invalid={errors.email ? 'true' : 'false'}
        aria-describedby={errors.email ? 'email-error' : undefined}
      />
      {errors.email && <div id="email-error" role="alert">{errors.email}</div>}
      <button type="submit">Login</button>
    </form>
  );
}
```

### Authentication and Authorization

**MUST** Implement proper CSRF protection for all state-changing operations.

**Rationale**: Cross-Site Request Forgery (CSRF) attacks can trick users into performing unintended actions on applications where they're authenticated.

**Example**:
```jsx
// Use CSRF tokens in forms
function TransferForm({ csrfToken }) {
  return (
    <form method="POST" action="/api/transfer">
      <input type="hidden" name="_token" value={csrfToken} />
      <input type="number" name="amount" required />
      <button type="submit">Transfer</button>
    </form>
  );
}

// For AJAX requests, include CSRF token in headers
const apiCall = async (data) => {
  const response = await fetch('/api/endpoint', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': getCsrfToken(),
    },
    body: JSON.stringify(data),
  });
  return response.json();
};
```

**SHOULD** Implement session timeout warnings and automatic logout.

**Rationale**: Prevents unauthorized access if users leave their sessions unattended.

**Example**:
```jsx
function SessionManager() {
  const [timeLeft, setTimeLeft] = useState(1800); // 30 minutes
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 300 && !showWarning) { // 5 minutes left
          setShowWarning(true);
        }
        if (prev <= 0) {
          logout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const extendSession = async () => {
    await refreshSession();
    setTimeLeft(1800);
    setShowWarning(false);
  };

  if (showWarning) {
    return (
      <div className="session-warning" role="alert">
        <p>Your session will expire in {Math.floor(timeLeft / 60)} minutes.</p>
        <button onClick={extendSession}>Extend Session</button>
      </div>
    );
  }

  return null;
}
```

### Accessibility

**MUST** Ensure all interactive elements are keyboard accessible.

**Rationale**: Users with motor disabilities or those who prefer keyboard navigation must be able to access all functionality.

**Example**:
```jsx
function AccessibleModal({ isOpen, onClose, children }) {
  const modalRef = useRef();
  const previousFocus = useRef();

  useEffect(() => {
    if (isOpen) {
      previousFocus.current = document.activeElement;
      modalRef.current?.focus();
    } else {
      previousFocus.current?.focus();
    }
  }, [isOpen]);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
    
    // Trap focus within modal
    if (e.key === 'Tab') {
      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="modal-overlay" 
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div 
        ref={modalRef}
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      >
        <button 
          className="close-button"
          onClick={onClose}
          aria-label="Close modal"
        >
          ×
        </button>
        {children}
      </div>
    </div>
  );
}
```

**MUST** Provide appropriate ARIA labels and roles for screen readers.

**Rationale**: Screen reader users need semantic information to understand and navigate the interface effectively.

**Example**:
```jsx
function DataTable({ data, columns }) {
  return (
    <table role="table" aria-label="User data">
      <thead>
        <tr>
          {columns.map(col => (
            <th key={col.key} scope="col">
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, index) => (
          <tr key={row.id}>
            {columns.map(col => (
              <td key={col.key}>
                {col.key === 'actions' ? (
                  <button 
                    aria-label={`Edit user ${row.name}`}
                    onClick={() => editUser(row.id)}
                  >
                    Edit
                  </button>
                ) : (
                  row[col.key]
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### Performance

**SHOULD** Implement lazy loading for images and non-critical components.

**Rationale**: Improves initial page load time and reduces bandwidth usage, especially important for mobile users.

**Example**:
```jsx
// Lazy loading images
function LazyImage({ src, alt, ...props }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef();

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={imgRef} {...props}>
      {isInView && (
        <img
          src={src}
          alt={alt}
          onLoad={() => setIsLoaded(true)}
          style={{
            opacity: isLoaded ? 1 : 0,
            transition: 'opacity 0.3s ease'
          }}
        />
      )}
    </div>
  );
}

// Lazy loading components
const HeavyComponent = lazy(() => import('./HeavyComponent'));

function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HeavyComponent />
    </Suspense>
  );
}
```

**MAY** Use React.memo for expensive component re-renders.

**Rationale**: Can improve performance for components that receive the same props frequently, but should be used judiciously as it adds overhead.

**Example**:
```jsx
const ExpensiveComponent = React.memo(function ExpensiveComponent({ data, onUpdate }) {
  const processedData = useMemo(() => {
    return data.map(item => ({
      ...item,
      computed: expensiveCalculation(item)
    }));
  }, [data]);

  return (
    <div>
      {processedData.map(item => (
        <div key={item.id} onClick={() => onUpdate(item)}>
          {item.computed}
        </div>
      ))}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function
  return prevProps.data === nextProps.data && 
         prevProps.onUpdate === nextProps.onUpdate;
});
```