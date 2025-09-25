import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Eye, 
  Edit, 
  Trash2,
  Mail,
  Calendar,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Clock
} from 'lucide-react';
import { DocumentsTable } from '@/components/Billing/DocumentsTable';
import { DocumentForm } from '@/components/Billing/DocumentForm';
import { DocumentViewDialog } from '@/components/Billing/DocumentViewDialog';
import { EmailSendModal } from '@/components/Billing/EmailSendModal';

const documentSchema = z.object({
  type: z.enum(['invoice', 'contract', 'receipt', 'proposal']),
  clientId: z.string().min(1, 'Cliente é obrigatório'),
  projectId: z.string().optional(),
  number: z.string().min(1, 'Número é obrigatório'),
  description: z.string().min(1, 'Descrição é obrigatória'),
  amount: z.number().min(0, 'Valor deve ser positivo'),
  dueDate: z.string().min(1, 'Data de vencimento é obrigatória'),
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']),
  notes: z.string().optional(),
});

type DocumentFormData = z.infer<typeof documentSchema>;

interface Document {
  id: string;
  type: 'invoice' | 'contract' | 'receipt' | 'proposal';
  clientId: string;
  clientName: string;
  projectId?: string;
  projectName?: string;
  number: string;
  description: string;
  amount: number;
  dueDate: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

function Billing() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<Document[]>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showDocumentForm, setShowDocumentForm] = useState(false);
  const [showDocumentView, setShowDocumentView] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [viewingDocument, setViewingDocument] = useState<Document | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const form = useForm<DocumentFormData>({
    resolver: zodResolver(documentSchema),
    defaultValues: {
      type: 'invoice',
      status: 'draft',
      amount: 0,
    },
  });

  // Mock data para demonstração
  useEffect(() => {
    const mockDocuments: Document[] = [
      {
        id: '1',
        type: 'invoice',
        clientId: '1',
        clientName: 'Silva & Associates',
        projectId: '1',
        projectName: 'Processo Trabalhista',
        number: 'FAT-2024-001',
        description: 'Honorários advocatícios - Processo trabalhista',
        amount: 5000.00,
        dueDate: '2024-02-15',
        status: 'sent',
        notes: 'Fatura referente aos serviços prestados no processo trabalhista',
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z',
      },
      {
        id: '2',
        type: 'contract',
        clientId: '2',
        clientName: 'Empresa ABC Ltda',
        number: 'CONT-2024-001',
        description: 'Contrato de prestação de serviços jurídicos',
        amount: 10000.00,
        dueDate: '2024-03-01',
        status: 'draft',
        notes: 'Contrato para assessoria jurídica empresarial',
        createdAt: '2024-01-10T09:00:00Z',
        updatedAt: '2024-01-10T09:00:00Z',
      },
      {
        id: '3',
        type: 'invoice',
        clientId: '3',
        clientName: 'João da Silva',
        projectId: '2',
        projectName: 'Inventário',
        number: 'FAT-2024-002',
        description: 'Honorários - Processo de inventário',
        amount: 3500.00,
        dueDate: '2024-01-30',
        status: 'paid',
        notes: 'Pagamento realizado via PIX',
        createdAt: '2024-01-05T14:00:00Z',
        updatedAt: '2024-01-30T16:00:00Z',
      },
    ];

    setTimeout(() => {
      setDocuments(mockDocuments);
      setFilteredDocuments(mockDocuments);
      setIsLoading(false);
    }, 1000);
  }, []);

  // Filtros
  useEffect(() => {
    let filtered = documents;

    if (searchTerm) {
      filtered = filtered.filter(doc =>
        doc.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.clientName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(doc => doc.status === statusFilter);
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(doc => doc.type === typeFilter);
    }

    setFilteredDocuments(filtered);
  }, [documents, searchTerm, statusFilter, typeFilter]);

  const handleCreateDocument = () => {
    setEditingDocument(null);
    form.reset();
    setShowDocumentForm(true);
  };

  const handleEditDocument = (document: Document) => {
    setEditingDocument(document);
    form.reset({
      type: document.type,
      clientId: document.clientId,
      projectId: document.projectId || '',
      number: document.number,
      description: document.description,
      amount: document.amount,
      dueDate: document.dueDate,
      status: document.status,
      notes: document.notes || '',
    });
    setShowDocumentForm(true);
  };

  const handleViewDocument = (document: Document) => {
    setViewingDocument(document);
    setShowDocumentView(true);
  };

  const handleSendEmail = () => {
    if (selectedDocuments.length === 0) {
      alert('Selecione pelo menos um documento para enviar por email');
      return;
    }
    setShowEmailModal(true);
  };

  const handleFormSubmit = async (data: DocumentFormData) => {
    setIsLoading(true);

    try {
      if (editingDocument) {
        // Atualizar documento existente
        const updatedDocument: Document = {
          ...editingDocument,
          ...data,
          clientName: 'Cliente Atualizado', // Mock
          updatedAt: new Date().toISOString(),
        };

        setDocuments(documents.map(doc => 
          doc.id === editingDocument.id ? updatedDocument : doc
        ));
      } else {
        // Criar novo documento
        const newDocument: Document = {
          id: Date.now().toString(),
          ...data,
          clientName: 'Novo Cliente', // Mock
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        setDocuments([...documents, newDocument]);
      }

      setShowDocumentForm(false);
      form.reset();
    } catch (error) {
      console.error('Erro ao salvar documento:', error);
      alert('Erro ao salvar documento');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteDocument = (documentId: string) => {
    if (confirm('Tem certeza que deseja excluir este documento?')) {
      setDocuments(documents.filter(doc => doc.id !== documentId));
      setSelectedDocuments(selectedDocuments.filter(id => id !== documentId));
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { label: 'Rascunho', className: 'bg-gray-100 text-gray-800' },
      sent: { label: 'Enviado', className: 'bg-blue-100 text-blue-800' },
      paid: { label: 'Pago', className: 'bg-green-100 text-green-800' },
      overdue: { label: 'Vencido', className: 'bg-red-100 text-red-800' },
      cancelled: { label: 'Cancelado', className: 'bg-gray-100 text-gray-800' },
    };

    const config = statusConfig[status as keyof typeof statusConfig];
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const getTypeLabel = (type: string) => {
    const typeLabels = {
      invoice: 'Fatura',
      contract: 'Contrato',
      receipt: 'Recibo',
      proposal: 'Proposta',
    };
    return typeLabels[type as keyof typeof typeLabels] || type;
  };

  // Estatísticas resumidas
  const totalAmount = documents.reduce((sum, doc) => sum + doc.amount, 0);
  const paidAmount = documents
    .filter(doc => doc.status === 'paid')
    .reduce((sum, doc) => sum + doc.amount, 0);
  const pendingAmount = documents
    .filter(doc => doc.status === 'sent')
    .reduce((sum, doc) => sum + doc.amount, 0);
  const overdueAmount = documents
    .filter(doc => doc.status === 'overdue')
    .reduce((sum, doc) => sum + doc.amount, 0);

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Faturamento</h1>
            <p className="text-gray-600 mt-1">Gerencie faturas, contratos e documentos</p>
          </div>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Faturamento</h1>
          <p className="text-gray-600 mt-1">Gerencie faturas, contratos e documentos</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleSendEmail}
            variant="outline"
            disabled={selectedDocuments.length === 0}
          >
            <Mail className="h-4 w-4 mr-2" />
            Enviar Email ({selectedDocuments.length})
          </Button>
          <Button onClick={handleCreateDocument}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Documento
          </Button>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Faturado</p>
                <p className="text-2xl font-bold text-gray-900">
                  R$ {totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Recebido</p>
                <p className="text-2xl font-bold text-gray-900">
                  R$ {paidAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pendente</p>
                <p className="text-2xl font-bold text-gray-900">
                  R$ {pendingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <AlertCircle className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Vencido</p>
                <p className="text-2xl font-bold text-gray-900">
                  R$ {overdueAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar por número, descrição ou cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="all">Todos os tipos</option>
                <option value="invoice">Faturas</option>
                <option value="contract">Contratos</option>
                <option value="receipt">Recibos</option>
                <option value="proposal">Propostas</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="all">Todos os status</option>
                <option value="draft">Rascunho</option>
                <option value="sent">Enviado</option>
                <option value="paid">Pago</option>
                <option value="overdue">Vencido</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Documentos */}
      <DocumentsTable
        documents={filteredDocuments}
        selectedDocuments={selectedDocuments}
        onSelectionChange={setSelectedDocuments}
        onEdit={handleEditDocument}
        onView={handleViewDocument}
        onDelete={handleDeleteDocument}
        getStatusBadge={getStatusBadge}
        getTypeLabel={getTypeLabel}
      />

      {/* Modais */}
      <DocumentForm
        open={showDocumentForm}
        onOpenChange={setShowDocumentForm}
        form={form}
        onSubmit={handleFormSubmit}
        editingDocument={editingDocument}
        isLoading={isLoading}
      />

      <DocumentViewDialog
        open={showDocumentView}
        onOpenChange={setShowDocumentView}
        document={viewingDocument}
        getStatusBadge={getStatusBadge}
        getTypeLabel={getTypeLabel}
      />

      <EmailSendModal
        open={showEmailModal}
        onOpenChange={setShowEmailModal}
        documents={documents.filter(doc => selectedDocuments.includes(doc.id))}
        onSendEmail={async (emailData) => {
          console.log('Enviando email:', emailData);
          alert('Email enviado com sucesso!');
          setShowEmailModal(false);
        }}
      />
    </div>
  );
}

export default Billing;