import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"

// Comprehensive country data with flags (using emoji flags)
const countries = [
  { code: "US", flag: "🇺🇸", name: "United States", dialCode: "+1" },
  { code: "CA", flag: "🇨🇦", name: "Canada", dialCode: "+1" },
  { code: "AU", flag: "🇦🇺", name: "Australia", dialCode: "+61" },
  { code: "LK", flag: "🇱🇰", name: "Sri Lanka", dialCode: "+94" },
  { code: "GB", flag: "🇬🇧", name: "United Kingdom", dialCode: "+44" },
  { code: "IN", flag: "🇮🇳", name: "India", dialCode: "+91" },
  { code: "CN", flag: "🇨🇳", name: "China", dialCode: "+86" },
  { code: "JP", flag: "🇯🇵", name: "Japan", dialCode: "+81" },
  { code: "KR", flag: "🇰🇷", name: "South Korea", dialCode: "+82" },
  { code: "SG", flag: "🇸🇬", name: "Singapore", dialCode: "+65" },
  { code: "MY", flag: "🇲🇾", name: "Malaysia", dialCode: "+60" },
  { code: "ID", flag: "🇮🇩", name: "Indonesia", dialCode: "+62" },
  { code: "TH", flag: "🇹🇭", name: "Thailand", dialCode: "+66" },
  { code: "VN", flag: "🇻🇳", name: "Vietnam", dialCode: "+84" },
  { code: "PH", flag: "🇵🇭", name: "Philippines", dialCode: "+63" },
  { code: "NZ", flag: "🇳🇿", name: "New Zealand", dialCode: "+64" },
  { code: "FR", flag: "🇫🇷", name: "France", dialCode: "+33" },
  { code: "DE", flag: "🇩🇪", name: "Germany", dialCode: "+49" },
  { code: "IT", flag: "🇮🇹", name: "Italy", dialCode: "+39" },
  { code: "ES", flag: "🇪🇸", name: "Spain", dialCode: "+34" },
  { code: "NL", flag: "🇳🇱", name: "Netherlands", dialCode: "+31" },
  { code: "BE", flag: "🇧🇪", name: "Belgium", dialCode: "+32" },
  { code: "CH", flag: "🇨🇭", name: "Switzerland", dialCode: "+41" },
  { code: "SE", flag: "🇸🇪", name: "Sweden", dialCode: "+46" },
  { code: "NO", flag: "🇳🇴", name: "Norway", dialCode: "+47" },
  { code: "DK", flag: "🇩🇰", name: "Denmark", dialCode: "+45" },
  { code: "FI", flag: "🇫🇮", name: "Finland", dialCode: "+358" },
  { code: "IE", flag: "🇮🇪", name: "Ireland", dialCode: "+353" },
  { code: "PT", flag: "🇵🇹", name: "Portugal", dialCode: "+351" },
  { code: "GR", flag: "🇬🇷", name: "Greece", dialCode: "+30" },
  { code: "PL", flag: "🇵🇱", name: "Poland", dialCode: "+48" },
  { code: "RU", flag: "🇷🇺", name: "Russia", dialCode: "+7" },
  { code: "MX", flag: "🇲🇽", name: "Mexico", dialCode: "+52" },
  { code: "BR", flag: "🇧🇷", name: "Brazil", dialCode: "+55" },
  { code: "AR", flag: "🇦🇷", name: "Argentina", dialCode: "+54" },
  { code: "ZA", flag: "🇿🇦", name: "South Africa", dialCode: "+27" },
  { code: "AE", flag: "🇦🇪", name: "United Arab Emirates", dialCode: "+971" },
  { code: "SA", flag: "🇸🇦", name: "Saudi Arabia", dialCode: "+966" },
  { code: "QA", flag: "🇶🇦", name: "Qatar", dialCode: "+974" },
  { code: "KW", flag: "🇰🇼", name: "Kuwait", dialCode: "+965" },
  { code: "BH", flag: "🇧🇭", name: "Bahrain", dialCode: "+973" },
  { code: "OM", flag: "🇴🇲", name: "Oman", dialCode: "+968" },
  { code: "LB", flag: "🇱🇧", name: "Lebanon", dialCode: "+961" },
  { code: "JO", flag: "🇯🇴", name: "Jordan", dialCode: "+962" },
  { code: "IL", flag: "🇮🇱", name: "Israel", dialCode: "+972" },
  { code: "EG", flag: "🇪🇬", name: "Egypt", dialCode: "+20" },
  { code: "TR", flag: "🇹🇷", name: "Turkey", dialCode: "+90" },
  { code: "PK", flag: "🇵🇰", name: "Pakistan", dialCode: "+92" },
  { code: "BD", flag: "🇧🇩", name: "Bangladesh", dialCode: "+880" },
  { code: "NP", flag: "🇳🇵", name: "Nepal", dialCode: "+977" },
  { code: "MM", flag: "🇲🇲", name: "Myanmar", dialCode: "+95" },
  { code: "KH", flag: "🇰🇭", name: "Cambodia", dialCode: "+855" },
  { code: "LA", flag: "🇱🇦", name: "Laos", dialCode: "+856" },
  { code: "BN", flag: "🇧🇳", name: "Brunei", dialCode: "+673" },
  { code: "TL", flag: "🇹🇱", name: "Timor-Leste", dialCode: "+670" },
  { code: "AF", flag: "🇦🇫", name: "Afghanistan", dialCode: "+93" },
  { code: "AL", flag: "🇦🇱", name: "Albania", dialCode: "+355" },
  { code: "DZ", flag: "🇩🇿", name: "Algeria", dialCode: "+213" },
  { code: "AS", flag: "🇦🇸", name: "American Samoa", dialCode: "+1684" },
  { code: "AD", flag: "🇦🇩", name: "Andorra", dialCode: "+376" },
  { code: "AO", flag: "🇦🇴", name: "Angola", dialCode: "+244" },
  { code: "AI", flag: "🇦🇮", name: "Anguilla", dialCode: "+1264" },
  { code: "AG", flag: "🇦🇬", name: "Antigua and Barbuda", dialCode: "+1268" },
  { code: "AM", flag: "🇦🇲", name: "Armenia", dialCode: "+374" },
  { code: "AW", flag: "🇦🇼", name: "Aruba", dialCode: "+297" },
  { code: "AT", flag: "🇦🇹", name: "Austria", dialCode: "+43" },
  { code: "AZ", flag: "🇦🇿", name: "Azerbaijan", dialCode: "+994" },
  { code: "BS", flag: "🇧🇸", name: "Bahamas", dialCode: "+1242" },
  { code: "BB", flag: "🇧🇧", name: "Barbados", dialCode: "+1246" },
  { code: "BY", flag: "🇧🇾", name: "Belarus", dialCode: "+375" },
  { code: "BZ", flag: "🇧🇿", name: "Belize", dialCode: "+501" },
  { code: "BJ", flag: "🇧🇯", name: "Benin", dialCode: "+229" },
  { code: "BM", flag: "🇧🇲", name: "Bermuda", dialCode: "+1441" },
  { code: "BT", flag: "🇧🇹", name: "Bhutan", dialCode: "+975" },
  { code: "BO", flag: "🇧🇴", name: "Bolivia", dialCode: "+591" },
  { code: "BA", flag: "🇧🇦", name: "Bosnia and Herzegovina", dialCode: "+387" },
  { code: "BW", flag: "🇧🇼", name: "Botswana", dialCode: "+267" },
  { code: "VG", flag: "🇻🇬", name: "British Virgin Islands", dialCode: "+1284" },
  { code: "BG", flag: "🇧🇬", name: "Bulgaria", dialCode: "+359" },
  { code: "BF", flag: "🇧🇫", name: "Burkina Faso", dialCode: "+226" },
  { code: "BI", flag: "🇧🇮", name: "Burundi", dialCode: "+257" },
  { code: "CV", flag: "🇨🇻", name: "Cape Verde", dialCode: "+238" },
  { code: "KY", flag: "🇰🇾", name: "Cayman Islands", dialCode: "+1345" },
  { code: "CF", flag: "🇨🇫", name: "Central African Republic", dialCode: "+236" },
  { code: "TD", flag: "🇹🇩", name: "Chad", dialCode: "+235" },
  { code: "CL", flag: "🇨🇱", name: "Chile", dialCode: "+56" },
  { code: "CO", flag: "🇨🇴", name: "Colombia", dialCode: "+57" },
  { code: "KM", flag: "🇰🇲", name: "Comoros", dialCode: "+269" },
  { code: "CG", flag: "🇨🇬", name: "Congo", dialCode: "+242" },
  { code: "CD", flag: "🇨🇩", name: "Congo (DRC)", dialCode: "+243" },
  { code: "CR", flag: "🇨🇷", name: "Costa Rica", dialCode: "+506" },
  { code: "CI", flag: "🇨🇮", name: "Côte d'Ivoire", dialCode: "+225" },
  { code: "HR", flag: "🇭🇷", name: "Croatia", dialCode: "+385" },
  { code: "CU", flag: "🇨🇺", name: "Cuba", dialCode: "+53" },
  { code: "CY", flag: "🇨🇾", name: "Cyprus", dialCode: "+357" },
  { code: "CZ", flag: "🇨🇿", name: "Czech Republic", dialCode: "+420" },
  { code: "DO", flag: "🇩🇴", name: "Dominican Republic", dialCode: "+1809" },
  { code: "EC", flag: "🇪🇨", name: "Ecuador", dialCode: "+593" },
  { code: "SV", flag: "🇸🇻", name: "El Salvador", dialCode: "+503" },
  { code: "GQ", flag: "🇬🇶", name: "Equatorial Guinea", dialCode: "+240" },
  { code: "ER", flag: "🇪🇷", name: "Eritrea", dialCode: "+291" },
  { code: "EE", flag: "🇪🇪", name: "Estonia", dialCode: "+372" },
  { code: "ET", flag: "🇪🇹", name: "Ethiopia", dialCode: "+251" },
  { code: "FJ", flag: "🇫🇯", name: "Fiji", dialCode: "+679" },
  { code: "GA", flag: "🇬🇦", name: "Gabon", dialCode: "+241" },
  { code: "GM", flag: "🇬🇲", name: "Gambia", dialCode: "+220" },
  { code: "GE", flag: "🇬🇪", name: "Georgia", dialCode: "+995" },
  { code: "GH", flag: "🇬🇭", name: "Ghana", dialCode: "+233" },
  { code: "GD", flag: "🇬🇩", name: "Grenada", dialCode: "+1473" },
  { code: "GT", flag: "🇬🇹", name: "Guatemala", dialCode: "+502" },
  { code: "GN", flag: "🇬🇳", name: "Guinea", dialCode: "+224" },
  { code: "GW", flag: "🇬🇼", name: "Guinea-Bissau", dialCode: "+245" },
  { code: "GY", flag: "🇬🇾", name: "Guyana", dialCode: "+592" },
  { code: "HT", flag: "🇭🇹", name: "Haiti", dialCode: "+509" },
  { code: "HN", flag: "🇭🇳", name: "Honduras", dialCode: "+504" },
  { code: "HK", flag: "🇭🇰", name: "Hong Kong", dialCode: "+852" },
  { code: "HU", flag: "🇭🇺", name: "Hungary", dialCode: "+36" },
  { code: "IS", flag: "🇮🇸", name: "Iceland", dialCode: "+354" },
  { code: "IR", flag: "🇮🇷", name: "Iran", dialCode: "+98" },
  { code: "IQ", flag: "🇮🇶", name: "Iraq", dialCode: "+964" },
  { code: "JM", flag: "🇯🇲", name: "Jamaica", dialCode: "+1876" },
  { code: "KZ", flag: "🇰🇿", name: "Kazakhstan", dialCode: "+7" },
  { code: "KE", flag: "🇰🇪", name: "Kenya", dialCode: "+254" },
  { code: "KI", flag: "🇰🇮", name: "Kiribati", dialCode: "+686" },
  { code: "XK", flag: "🇽🇰", name: "Kosovo", dialCode: "+383" },
  { code: "KG", flag: "🇰🇬", name: "Kyrgyzstan", dialCode: "+996" },
  { code: "LV", flag: "🇱🇻", name: "Latvia", dialCode: "+371" },
  { code: "LS", flag: "🇱🇸", name: "Lesotho", dialCode: "+266" },
  { code: "LR", flag: "🇱🇷", name: "Liberia", dialCode: "+231" },
  { code: "LY", flag: "🇱🇾", name: "Libya", dialCode: "+218" },
  { code: "LI", flag: "🇱🇮", name: "Liechtenstein", dialCode: "+423" },
  { code: "LT", flag: "🇱🇹", name: "Lithuania", dialCode: "+370" },
  { code: "LU", flag: "🇱🇺", name: "Luxembourg", dialCode: "+352" },
  { code: "MO", flag: "🇲🇴", name: "Macau", dialCode: "+853" },
  { code: "MG", flag: "🇲🇬", name: "Madagascar", dialCode: "+261" },
  { code: "MW", flag: "🇲🇼", name: "Malawi", dialCode: "+265" },
  { code: "MV", flag: "🇲🇻", name: "Maldives", dialCode: "+960" },
  { code: "ML", flag: "🇲🇱", name: "Mali", dialCode: "+223" },
  { code: "MT", flag: "🇲🇹", name: "Malta", dialCode: "+356" },
  { code: "MH", flag: "🇲🇭", name: "Marshall Islands", dialCode: "+692" },
  { code: "MR", flag: "🇲🇷", name: "Mauritania", dialCode: "+222" },
  { code: "MU", flag: "🇲🇺", name: "Mauritius", dialCode: "+230" },
  { code: "FM", flag: "🇫🇲", name: "Micronesia", dialCode: "+691" },
  { code: "MD", flag: "🇲🇩", name: "Moldova", dialCode: "+373" },
  { code: "MC", flag: "🇲🇨", name: "Monaco", dialCode: "+377" },
  { code: "MN", flag: "🇲🇳", name: "Mongolia", dialCode: "+976" },
  { code: "ME", flag: "🇲🇪", name: "Montenegro", dialCode: "+382" },
  { code: "MS", flag: "🇲🇸", name: "Montserrat", dialCode: "+1664" },
  { code: "MA", flag: "🇲🇦", name: "Morocco", dialCode: "+212" },
  { code: "MZ", flag: "🇲🇿", name: "Mozambique", dialCode: "+258" },
  { code: "NA", flag: "🇳🇦", name: "Namibia", dialCode: "+264" },
  { code: "NR", flag: "🇳🇷", name: "Nauru", dialCode: "+674" },
  { code: "NC", flag: "🇳🇨", name: "New Caledonia", dialCode: "+687" },
  { code: "NI", flag: "🇳🇮", name: "Nicaragua", dialCode: "+505" },
  { code: "NE", flag: "🇳🇪", name: "Niger", dialCode: "+227" },
  { code: "NG", flag: "🇳🇬", name: "Nigeria", dialCode: "+234" },
  { code: "NU", flag: "🇳🇺", name: "Niue", dialCode: "+683" },
  { code: "NF", flag: "🇳🇫", name: "Norfolk Island", dialCode: "+672" },
  { code: "MK", flag: "🇲🇰", name: "North Macedonia", dialCode: "+389" },
  { code: "MP", flag: "🇲🇵", name: "Northern Mariana Islands", dialCode: "+1670" },
  { code: "PS", flag: "🇵🇸", name: "Palestine", dialCode: "+970" },
  { code: "PA", flag: "🇵🇦", name: "Panama", dialCode: "+507" },
  { code: "PG", flag: "🇵🇬", name: "Papua New Guinea", dialCode: "+675" },
  { code: "PY", flag: "🇵🇾", name: "Paraguay", dialCode: "+595" },
  { code: "PE", flag: "🇵🇪", name: "Peru", dialCode: "+51" },
  { code: "PN", flag: "🇵🇳", name: "Pitcairn", dialCode: "+872" },
  { code: "PR", flag: "🇵🇷", name: "Puerto Rico", dialCode: "+1787" },
  { code: "RO", flag: "🇷🇴", name: "Romania", dialCode: "+40" },
  { code: "RW", flag: "🇷🇼", name: "Rwanda", dialCode: "+250" },
  { code: "WS", flag: "🇼🇸", name: "Samoa", dialCode: "+685" },
  { code: "SM", flag: "🇸🇲", name: "San Marino", dialCode: "+378" },
  { code: "ST", flag: "🇸🇹", name: "São Tomé and Príncipe", dialCode: "+239" },
  { code: "SN", flag: "🇸🇳", name: "Senegal", dialCode: "+221" },
  { code: "RS", flag: "🇷🇸", name: "Serbia", dialCode: "+381" },
  { code: "SC", flag: "🇸🇨", name: "Seychelles", dialCode: "+248" },
  { code: "SL", flag: "🇸🇱", name: "Sierra Leone", dialCode: "+232" },
  { code: "SK", flag: "🇸🇰", name: "Slovakia", dialCode: "+421" },
  { code: "SI", flag: "🇸🇮", name: "Slovenia", dialCode: "+386" },
  { code: "SB", flag: "🇸🇧", name: "Solomon Islands", dialCode: "+677" },
  { code: "SO", flag: "🇸🇴", name: "Somalia", dialCode: "+252" },
  { code: "GS", flag: "🇬🇸", name: "South Georgia", dialCode: "+500" },
  { code: "SS", flag: "🇸🇸", name: "South Sudan", dialCode: "+211" },
  { code: "SD", flag: "🇸🇩", name: "Sudan", dialCode: "+249" },
  { code: "SR", flag: "🇸🇷", name: "Suriname", dialCode: "+597" },
  { code: "SZ", flag: "🇸🇿", name: "Eswatini", dialCode: "+268" },
  { code: "TW", flag: "🇹🇼", name: "Taiwan", dialCode: "+886" },
  { code: "TZ", flag: "🇹🇿", name: "Tanzania", dialCode: "+255" },
  { code: "TG", flag: "🇹🇬", name: "Togo", dialCode: "+228" },
  { code: "TK", flag: "🇹🇰", name: "Tokelau", dialCode: "+690" },
  { code: "TO", flag: "🇹🇴", name: "Tonga", dialCode: "+676" },
  { code: "TT", flag: "🇹🇹", name: "Trinidad and Tobago", dialCode: "+1868" },
  { code: "TN", flag: "🇹🇳", name: "Tunisia", dialCode: "+216" },
  { code: "TM", flag: "🇹🇲", name: "Turkmenistan", dialCode: "+993" },
  { code: "TC", flag: "🇹🇨", name: "Turks and Caicos", dialCode: "+1649" },
  { code: "TV", flag: "🇹🇻", name: "Tuvalu", dialCode: "+688" },
  { code: "UG", flag: "🇺🇬", name: "Uganda", dialCode: "+256" },
  { code: "UA", flag: "🇺🇦", name: "Ukraine", dialCode: "+380" },
  { code: "UY", flag: "🇺🇾", name: "Uruguay", dialCode: "+598" },
  { code: "UZ", flag: "🇺🇿", name: "Uzbekistan", dialCode: "+998" },
  { code: "VU", flag: "🇻🇺", name: "Vanuatu", dialCode: "+678" },
  { code: "VA", flag: "🇻🇦", name: "Vatican City", dialCode: "+39" },
  { code: "VE", flag: "🇻🇪", name: "Venezuela", dialCode: "+58" },
  { code: "VG", flag: "🇻🇬", name: "Virgin Islands (British)", dialCode: "+1284" },
  { code: "VI", flag: "🇻🇮", name: "Virgin Islands (US)", dialCode: "+1340" },
  { code: "YE", flag: "🇾🇪", name: "Yemen", dialCode: "+967" },
  { code: "ZM", flag: "🇿🇲", name: "Zambia", dialCode: "+260" },
  { code: "ZW", flag: "🇿🇼", name: "Zimbabwe", dialCode: "+263" },
].sort((a, b) => a.name.localeCompare(b.name))

interface PhoneInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value?: string
  onChange?: (value: string) => void
  defaultCountry?: string
}

export function PhoneInput({ value = "", onChange, defaultCountry = "+61", className, ...props }: PhoneInputProps) {
  const [open, setOpen] = React.useState(false)
  const [selectedCountry, setSelectedCountry] = React.useState(() => {
    const found = countries.find((c) => c.dialCode === defaultCountry) || 
                  countries.find((c) => c.dialCode === "+61") || 
                  countries[0]
    return found
  })
  const [phoneNumber, setPhoneNumber] = React.useState("")
  const lastParsedValue = React.useRef<string>("")

  React.useEffect(() => {
    // Skip parsing if value hasn't changed (prevent unnecessary re-parsing)
    if (value === lastParsedValue.current) {
      return
    }

    // Parse existing value if it starts with a country code
    if (value) {
      // Sort countries by dial code length (longest first) to match longer codes first
      const sortedCountries = [...countries].sort((a, b) => b.dialCode.length - a.dialCode.length)
      
      // Try to find a matching country code
      const foundCountry = sortedCountries.find((country) => {
        // Check if value starts with the dial code (with or without space)
        const dialCodeWithSpace = country.dialCode + " "
        return value.startsWith(country.dialCode) || value.startsWith(dialCodeWithSpace)
      })
      
      if (foundCountry) {
        // Extract phone number part (remove country code and any leading space)
        const phonePart = value.replace(foundCountry.dialCode, "").trim().replace(/\D/g, "")
        
        setSelectedCountry(foundCountry)
        setPhoneNumber(phonePart)
      } else {
        // If no country code found, assume it's just the phone number
        setPhoneNumber(value.replace(/\D/g, ""))
      }
    } else {
      setPhoneNumber("")
    }
    
    lastParsedValue.current = value
  }, [value])

  const handleCountrySelect = (country: typeof countries[0]) => {
    setSelectedCountry(country)
    setOpen(false)
    const newValue = country.dialCode + (phoneNumber ? " " + phoneNumber : "")
    lastParsedValue.current = newValue
    onChange?.(newValue)
  }

  const isCountrySelected = (country: typeof countries[0]) => {
    return selectedCountry.code === country.code && 
           selectedCountry.dialCode === country.dialCode &&
           selectedCountry.name === country.name
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPhone = e.target.value.replace(/\D/g, "") // Only allow digits
    setPhoneNumber(newPhone)
    // Format: +XX XXXXXXXXX
    const newValue = selectedCountry.dialCode + (newPhone ? " " + newPhone : "")
    lastParsedValue.current = newValue
    onChange?.(newValue)
  }

  return (
    <div className={cn("flex gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-[110px] justify-between"
          >
            <span className="flex items-center gap-2">
              <span className="text-lg">{selectedCountry.flag}</span>
              <span className="text-sm">{selectedCountry.dialCode}</span>
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search country..." />
            <CommandList>
              <CommandEmpty>No country found.</CommandEmpty>
              <CommandGroup>
                {countries.map((country) => (
                  <CommandItem
                    key={`${country.code}-${country.dialCode}-${country.name}`}
                    value={`${country.name} ${country.dialCode} ${country.code}`}
                    onSelect={() => handleCountrySelect(country)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        isCountrySelected(country) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="mr-2 text-lg">{country.flag}</span>
                    <span className="flex-1">{country.name}</span>
                    <span className="text-sm text-muted-foreground">{country.dialCode}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Input
        type="tel"
        placeholder="Phone number"
        value={phoneNumber}
        onChange={handlePhoneChange}
        className="flex-1"
        {...props}
      />
    </div>
  )
}

